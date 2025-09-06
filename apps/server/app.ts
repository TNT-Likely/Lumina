
import path from 'path'
import dotenv from 'dotenv'
import { Application } from 'egg'

import { SubscriptionManager } from '@lumina/subscription'
import { createAppLogger, getLogger, type LogLevel } from '@lumina/logger'

if (process.env.NODE_ENV === 'production') {
  const rootEnv = path.resolve(__dirname, '../../.env')
  dotenv.config({ path: rootEnv, override: false })
}

const rootEnvLocal = path.resolve(__dirname, '../../.env.local')
dotenv.config({ path: rootEnvLocal, override: false })
// 在 test 环境下，允许 .env.test 覆盖前述变量，确保测试隔离
if (process.env.NODE_ENV === 'test') {
  const rootEnvTest = path.resolve(__dirname, '../../.env.test')
  dotenv.config({ path: rootEnvTest, override: true })
}

declare module 'egg' {
  interface Application {
    manager?: SubscriptionManager;
  }
}

export default class AppBootHook {
  app: Application
  constructor(app: Application) {
    this.app = app
  }

  async didReady() {
    // 初始化日志（尽早），默认仅记录失败；控制台与文件可用环境变量开关
    const enableConsole = process.env.LOG_CONSOLE === 'true' || process.env.NODE_ENV !== 'production'
    const enableFile = process.env.LOG_FILE === 'true' || process.env.NODE_ENV === 'production'
    const logLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel
    const logDir = process.env.LOG_DIR || path.resolve(__dirname, '../../logs')
    const logDays = Number(process.env.LOG_DAYS || 7)
    const logSize = process.env.LOG_SIZE || '20M'
    createAppLogger({
      level: logLevel,
      pretty: enableConsole,
      file: enableFile ? { enabled: true, dir: logDir, pattern: '1d', size: logSize, days: logDays, rotateBy: 'time' } : { enabled: false },
    })
    const logger = getLogger()
    // 初始化数据层（在 dotenv 之后）
    const { initializeData, seedAdminIfNeeded } = await import('@lumina/data')
    try {
      await initializeData()
      logger.info('[健康检查] MySQL 连接成功')
    } catch (e) {
      logger.error({ err: e instanceof Error ? e.message : String(e) }, '[健康检查] MySQL 连接失败')
      throw e
    }
    // ensure default admin exists (skip in test to avoid double seeding with mocha root hooks)
    if (process.env.NODE_ENV !== 'test') {
      try { await seedAdminIfNeeded() } catch (e) { console.error('seed admin failed', e) }
    }
    // 在测试环境跳过订阅管理器，避免占用外部依赖
    if (process.env.NODE_ENV !== 'test') {
      const manager = new SubscriptionManager()
      // MQ 与 Redis 使用环境变量
      const mqUser = process.env.MQ_USER || 'admin'
      const mqPass = process.env.MQ_PASS || 'admin'
      const mqHost = process.env.MQ_HOST || 'localhost'
      const mqPort = Number(process.env.MQ_PORT || 5672)
      const mqVhost = process.env.MQ_VHOST || ''
      const vhostPart = mqVhost ? `/${mqVhost.replace(/^\//, '')}` : ''
      const mqUrl = `amqp://${mqUser}:${mqPass}@${mqHost}:${mqPort}${vhostPart}`

      const redisHost = process.env.REDIS_HOST || '127.0.0.1'
      const redisPort = Number(process.env.REDIS_PORT || 6379)
      const redisPassword = process.env.REDIS_PASSWORD || undefined
      const redisDb = Number(process.env.REDIS_DB || 0)
      try {
        await manager.init({ mqUrl }, { host: redisHost, port: redisPort, password: redisPassword, db: redisDb })
        logger.info('[健康检查] MQ 与 Redis 初始化完成')
      } catch (e) {
        logger.error({ err: e instanceof Error ? e.message : String(e) }, '[健康检查] MQ/Redis 初始化失败')
        throw e
      }
      await manager.scheduleBatch()
      manager.startSubscriptionInspector()
      manager.consumeAll()
      this.app.manager = manager
      logger.info('[订阅] 所有订阅已批量调度')
    }
  }
}
