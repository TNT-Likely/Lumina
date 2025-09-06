import { Controller } from 'egg'
import jwt from 'jsonwebtoken'
import { authService, Organization, OrganizationMember } from '@lumina/data'
import { Notify, NotifyChannel } from '@lumina/notify'

const ACCESS_TTL_SEC = 60 * 15 // 15m
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7 // 7d

export default class AuthController extends Controller {
  private signTokens(payload: Record<string, unknown>) {
    const accessToken = jwt.sign(payload, this.ctx.app.config.keys, { expiresIn: ACCESS_TTL_SEC })
    const refreshToken = jwt.sign({ ...payload, t: 'refresh' }, this.ctx.app.config.keys, { expiresIn: REFRESH_TTL_SEC })
    return { accessToken, refreshToken }
  }

  public async login() {
    const { ctx } = this
    const { identifier, password } = ctx.request.body || {}
    if (!identifier || !password) {
      ctx.body = { success: false, message: '缺少用户名/邮箱或密码' }
      return
    }
    const user = await authService.verifyPassword(identifier, password)
    if (!user) {
      ctx.body = { success: false, message: '用户名或密码错误' }
      return
    }
    await authService.updateLastLogin(user.id)
    const payload = { uid: user.id, username: user.username }
    const { accessToken, refreshToken } = this.signTokens(payload)
    // 写 cookie（注意本地 http 下 SameSite=None 需要 Secure，开发环境可能被浏览器丢弃，客户端也会接收 body 中的 refreshToken 以兜底）
    ctx.cookies.set('rt', refreshToken, { httpOnly: true, sameSite: 'lax' })
    ctx.body = { success: true, data: { accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } } }
  }

  public async refresh() {
    const { ctx } = this
    const token = ctx.cookies.get('rt') || (ctx.request.body && (ctx.request.body as { refreshToken?: string }).refreshToken)
    if (!token) {
      ctx.body = { success: false, message: '缺少刷新凭证' }
      return
    }
    try {
      const decoded = jwt.verify(token, ctx.app.config.keys) as { t?: string; uid: number; username: string }
      if (decoded.t !== 'refresh') throw new Error('invalid token')
      const { accessToken } = this.signTokens({ uid: decoded.uid, username: decoded.username })
      ctx.body = { success: true, data: { accessToken } }
    } catch {
      ctx.body = { success: false, message: '刷新失败，请重新登录' }
    }
  }

  public async register() {
    const { ctx } = this
    const { email, username, password } = ctx.request.body || {}
    if (!email || !username || !password) {
      ctx.body = { success: false, message: '缺少 email/username/password' }
      return
    }
    try {
      const user = await authService.register({ email, username, password })
      // 自动加入默认组织（viewer）
      try {
        let org = await Organization.findOne({ where: { slug: 'default' } })
        if (!org) org = await Organization.create({ name: '默认组织', slug: 'default' })
        await OrganizationMember.findOrCreate({ where: { orgId: org.id, userId: user.id }, defaults: { orgId: org.id, userId: user.id, role: 'VIEWER' } })
      } catch (e) { ctx.logger.warn('[register] 加入默认组织失败: %s', (e as Error).message) }
      // 发送验证邮件（可选）
      try {
        if (process.env.MAIL_HOST && process.env.MAIL_FROM && process.env.MAIL_USER && process.env.MAIL_PASS) {
          const token = await authService.createEmailVerifyToken(user.id)
          const appHost = process.env.WEB_URL || `http://${ctx.host}`
          const url = `${appHost}/verify-email?token=${encodeURIComponent(token)}`
          const mail = Notify({
            type: NotifyChannel.Email,
            properties: {
              host: process.env.MAIL_HOST,
              port: Number(process.env.MAIL_PORT || 465),
              secure: process.env.MAIL_SECURE === 'true',
              from: process.env.MAIL_FROM,
              user: process.env.MAIL_USER,
              pass: process.env.MAIL_PASS,
              to: email,
            },
          })
          const html = `
            <div style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width: 560px;">
              <h2>欢迎加入 Lumina</h2>
              <p>请点击下方按钮完成邮箱验证：</p>
              <p>
                <a href="${url}"
                   style="display:inline-block;padding:10px 16px;background:#1677ff;color:#fff;text-decoration:none;border-radius:4px">
                  验证邮箱
                </a>
              </p>
              <p style="margin-top:8px;color:#666">如果按钮无法点击，请复制下面的链接到浏览器打开：</p>
              <p><a href="${url}">${url}</a></p>
              <p style="color:#999">链接 24 小时内有效。</p>
            </div>`
          await mail.sendMarkdown({ text: html, subject: '验证你的邮箱' })
        } else {
          const token2 = await authService.createEmailVerifyToken(user.id)
          const link = `${process.env.WEB_URL || `http://${ctx.host}`}/verify-email?token=${encodeURIComponent(token2)}`
          ctx.logger.info('[register-email] 未配置邮件服务，控制台输出验证链接: %s', link)
        }
      } catch (e) { ctx.logger.warn('[register-email] 发送失败: %s', (e as Error).message) }
      ctx.body = { success: true, data: { id: user.id, email: user.email, username: user.username } }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || '注册失败' }
    }
  }

  public async verifyEmail() {
    const { ctx } = this
    const token = String(ctx.query.token || '')
    try {
      if (!token) throw new Error('缺少 token')
      const rec = await authService.verifyAndConsumeToken('verify', token)
      if (!rec) throw new Error('链接无效或已过期')
      await authService.markUserActive(rec.userId)
      // 激活时补偿：若未加入默认组织则加入
      try {
        let org = await Organization.findOne({ where: { slug: 'default' } })
        if (!org) org = await Organization.create({ name: '默认组织', slug: 'default' })
        await OrganizationMember.findOrCreate({ where: { orgId: org.id, userId: rec.userId }, defaults: { orgId: org.id, userId: rec.userId, role: 'VIEWER' } })
      } catch (e) { ctx.logger.warn('[verifyEmail] 默认组织补偿失败: %s', (e as Error).message) }
      ctx.body = { success: true }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || '验证失败' }
    }
  }

  public async forgotPassword() {
    const { ctx } = this
    const { email } = ctx.request.body || {}
    if (!email) { ctx.body = { success: false, message: '缺少邮箱' }; return }
    try {
      const user = await authService.findByUsernameOrEmail(email)
      if (!user) { ctx.body = { success: true }; return }
      const token = await authService.createPasswordResetToken(user.id)
      if (process.env.MAIL_HOST && process.env.MAIL_FROM && process.env.MAIL_USER && process.env.MAIL_PASS) {
        const appHost = process.env.WEB_URL || `http://${ctx.host}`
        const url = `${appHost}/reset-password?token=${encodeURIComponent(token)}`
        const mail = Notify({
          type: NotifyChannel.Email,
          properties: {
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT || 465),
            secure: process.env.MAIL_SECURE === 'true',
            from: process.env.MAIL_FROM,
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
            to: email,
          },
        })
        const html2 = `
          <div style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width: 560px;">
            <h2>重置密码</h2>
            <p>请点击下方按钮重置你的密码：</p>
            <p>
              <a href="${url}"
                 style="display:inline-block;padding:10px 16px;background:#1677ff;color:#fff;text-decoration:none;border-radius:4px">
                重置密码
              </a>
            </p>
            <p style="margin-top:8px;color:#666">如果按钮无法点击，请复制下面的链接到浏览器打开：</p>
            <p><a href="${url}">${url}</a></p>
            <p style="color:#999">链接 2 小时内有效。</p>
          </div>`
        await mail.sendMarkdown({ text: html2, subject: '重置你的密码' })
      } else {
        const link = `${process.env.WEB_URL || `http://${ctx.host}`}/reset-password?token=${encodeURIComponent(token)}`
        ctx.logger.info('[reset-password] 未配置邮件服务，控制台输出链接: %s', link)
      }
      ctx.body = { success: true }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || '发送失败' }
    }
  }

  public async resetPassword() {
    const { ctx } = this
    const { token, password } = ctx.request.body || {}
    if (!token || !password) { ctx.body = { success: false, message: '参数缺失' }; return }
    try {
      const rec = await authService.verifyAndConsumeToken('reset', String(token))
      if (!rec) throw new Error('链接无效或已过期')
      await authService.updatePassword(rec.userId, String(password))
      ctx.body = { success: true }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || '重置失败' }
    }
  }

  public async logout() {
    const { ctx } = this
    ctx.cookies.set('rt', '', { httpOnly: true, expires: new Date(0) })
    ctx.body = { success: true, data: true }
  }
}
