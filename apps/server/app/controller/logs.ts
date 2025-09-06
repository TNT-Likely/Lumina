import { Controller } from 'egg'
import fs from 'node:fs'
import path from 'node:path'

export default class LogsController extends Controller {
  // GET /api/admin/logs?lines=200&file=today
  async tail() {
    const { ctx } = this
    // RBAC: 仅 admin
    if (!ctx.state?.user || ctx.state?.user?.role !== 'admin') {
      ctx.status = 403
      ctx.body = { success: false, code: 403, message: 'forbidden' }
      return
    }

    const lines = Math.min(Number(ctx.query.lines || 200), 1000)
    const file = String(ctx.query.file || 'today')

    const logDir = process.env.LOG_DIR || path.resolve(__dirname, '../../../logs')
    let filePath: string
    if (file === 'today') {
      // 兼容 app.log（未轮转时）与 app-YYYYMMDD.log（已轮转）
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      const dated = path.join(logDir, `app-${y}${m}${d}.log`)
      const plain = path.join(logDir, 'app.log')
      filePath = fs.existsSync(dated) ? dated : plain
    } else {
      filePath = path.join(logDir, file)
    }

    if (!fs.existsSync(filePath)) {
      ctx.status = 404
      ctx.body = { success: false, code: 404, message: 'log file not found' }
      return
    }

    const stat = fs.statSync(filePath)
    const maxBytes = 1024 * 1024 // 最多读 1MB
    const start = Math.max(0, stat.size - maxBytes)
    const buf = Buffer.alloc(Math.min(maxBytes, stat.size))
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, buf.length, start)
    fs.closeSync(fd)

    const content = buf.toString('utf8')
    const lastLines = content.trimEnd().split(/\r?\n/).slice(-lines)
    ctx.set('content-type', 'text/plain; charset=utf-8')
    ctx.body = lastLines.join('\n')
  }
}
