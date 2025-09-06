import type { Context } from 'egg'
import { AppError } from '@lumina/data'
import Redis from 'ioredis'

type KeyGen = (ctx: Context) => string;

interface RateLimitOptions {
  windowMs: number
  max: number
  keyGenerator?: KeyGen
}

// 单例 Redis 客户端
let redisClient: Redis | null = null
function getRedis(): Redis {
  if (redisClient) return redisClient
  // 仅使用分散配置，不再支持 REDIS_URL
  const host = process.env.REDIS_HOST || '127.0.0.1'
  const port = Number(process.env.REDIS_PORT || 6379)
  const password = process.env.REDIS_PASSWORD || undefined
  const db = Number(process.env.REDIS_DB || 0)
  redisClient = new Redis({ host, port, password, db, enableOfflineQueue: true, lazyConnect: false })
  return redisClient
}

export default function rateLimit(options?: Partial<RateLimitOptions>) {
  const windowMs = options?.windowMs ?? 60_000
  const max = options?.max ?? 120
  const keyGen: KeyGen = options?.keyGenerator ?? (ctx => {
    const uid = (ctx.state?.user?.id ? `u:${ctx.state.user.id}` : null)
    return uid || `ip:${ctx.ip}`
  })

  // 使用 INCR + EXPIRE 实现滑动窗口近似（固定窗口）
  return async function rateLimitMiddleware(ctx: Context, next: () => Promise<void>) {
    const key = keyGen(ctx)
    const bucketKey = `ratelimit:${key}:${Math.floor(Date.now() / windowMs)}`
    try {
      const redis = getRedis()
      // 自增并设置 TTL（首次设置）
      const count = await redis.incr(bucketKey)
      if (count === 1) {
        await redis.pexpire(bucketKey, windowMs)
      }
      if (count > max) {
        throw new AppError('Too Many Requests', 429, 'TOO_MANY_REQUESTS', { key, windowMs, max })
      }
    } catch (err) {
      // Redis 不可用时，降级放行，避免影响主流程
      if (ctx.logger) ctx.logger.warn('[rateLimit] redis error: %s', (err as Error)?.message)
    }
    await next()
  }
}
