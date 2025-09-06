import { Controller } from 'egg'
import { orgManagementService } from '@lumina/data'
import { Notify, NotifyChannel } from '@lumina/notify'

export default class AdminOrgInvitesController extends Controller {
  async list() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    try {
      // ADMIN 权限由中间件统一校验
      const data = await orgManagementService.listInvites(orgId)
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async create() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const { email, role, ttlHours } = ctx.request.body || {}
    try {
      // ADMIN 权限由中间件统一校验
      const data = await orgManagementService.createInvite(orgId, email, role, ttlHours)
      // 发送邀请邮件（若配置了邮件环境变量）
      try {
        const appHost = process.env.WEB_URL || `http://${ctx.host}`
        const acceptUrl = `${appHost}/invite/accept?token=${encodeURIComponent(data.token)}&orgId=${orgId}`
        if (process.env.MAIL_HOST && process.env.MAIL_FROM && process.env.MAIL_USER && process.env.MAIL_PASS) {
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
          const orgName = String(orgId)
          const html = `
            <div style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <h2>邀请加入组织</h2>
              <p>您被邀请加入组织（ID: ${orgName}），角色：<b>${role}</b>。</p>
              <p>点击下方按钮接受邀请：</p>
              <p><a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#1677ff;color:#fff;text-decoration:none;border-radius:4px">接受邀请</a></p>
              <p>或复制链接到浏览器打开：<br/>
                <a href="${acceptUrl}">${acceptUrl}</a>
              </p>
              ${ttlHours ? `<p style="color:#999">有效期：${ttlHours} 小时</p>` : ''}
            </div>`
          await mail.sendMarkdown({ text: html, subject: '组织邀请通知' })
        }
      } catch (e) {
        ctx.logger.warn('[invite-email] 发送失败: %s', (e as Error).message)
      }
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async revoke() {
    const { ctx } = this
    const id = Number(ctx.params.id)
    try {
      const ok = await orgManagementService.revokeInvite(id)
      if (!ok) { ctx.status = 404; ctx.body = { success: false, message: '邀请不存在' }; return }
      ctx.body = { success: true }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async createBatch() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const { items } = ctx.request.body as { items: Array<{ email: string, role: 'ADMIN'|'EDITOR'|'VIEWER', ttlHours?: number }> } || { items: [] }
    try {
      const data = await orgManagementService.createInvites(orgId, Array.isArray(items) ? items : [])
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }
}
