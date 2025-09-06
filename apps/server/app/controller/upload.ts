import { Controller } from 'egg'
import path from 'path'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default class UploadController extends Controller {
  // 通用上传接口：用于头像等小文件上传，返回可访问URL
  async create() {
    const { ctx } = this
    const userId = ctx.state.user?.id
    if (!userId) { ctx.status = 401; ctx.body = { success: false, code: 401, message: '未登录' }; return }

    try {
      // 测试与故障演练：显式禁用存储，直接返回 501
      if (process.env.LUMINA_FORCE_NO_STORAGE === '1') {
        ctx.status = 501
        ctx.body = { success: false, code: 501, message: '未配置或配置错误的存储（STORAGE_TYPE），无法上传' }
        return
      }
      // 动态加载存储；@lumina/storage 在未设置 STORAGE_TYPE 会抛出 Unknown STORAGE_TYPE
      let uploadFile: (args: { filename: string; filepath?: string; content: Buffer | string; contentType?: string }) => Promise<string>
      try {
        const mod = await import('@lumina/storage')
        uploadFile = mod.uploadFile
      } catch {
        ctx.status = 501
        ctx.body = { success: false, code: 501, message: '未配置或配置错误的存储（STORAGE_TYPE），无法上传' }
        return
      }

      const stream = await ctx.getFileStream({ requireFile: true })
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)
      const orig = stream.filename || 'file'
      const ext = path.extname(orig) || ''
      const safe = sanitizeFilename(path.basename(orig, ext))
      const keyName = `${safe || 'file'}${ext}`
      const category = (stream.fields?.category as string) || 'misc'
      const filepath = `${category}/${userId}/${Date.now()}`

      const url = await uploadFile({
        filename: keyName,
        filepath,
        content: buffer,
        contentType: (stream as unknown as { mime?: string }).mime || undefined,
      })

      ctx.body = { success: true, data: { url, filename: keyName } }
    } catch (e) {
      const msg = (e as Error).message || '上传失败'
      // 存储配置错误统一视为 501（未配置/配置错误）
      if (msg.includes('Unknown STORAGE_TYPE') || msg.includes('config incomplete')) {
        ctx.status = 501
      } else {
        ctx.status = 400
      }
      ctx.body = { success: false, code: ctx.status, message: msg }
    }
  }
}
