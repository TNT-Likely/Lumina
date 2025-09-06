import Scheduler, { type SchedulerInitOptions } from '@lumina/scheduler'
import { notifyService, subscribeService, messageConsumeLogService } from '@lumina/data'
import Notify, { NotifyChannel } from '@lumina/notify'
import { CronExpressionParser } from 'cron-parser'
import { CronJob } from 'cron'
import type { NotificationType, Subscription } from '@lumina/types'
import type { SubscriptionMessage, ConsumeResult, InspectResult, SubscriptionStatus } from './types'
import Redis, { RedisOptions } from 'ioredis'
import { getLogger } from '@lumina/logger'

// buildSubscriptionMessage 工具函数
function buildSubscriptionMessage (
  sub: Subscription,
  sendAt: Date,
  nextSendAt?: Date
): SubscriptionMessage {
  const sendAtStr = sendAt.toISOString()
  return {
    subscriptionId: sub.id,
    dashboardId: sub.dashboardId,
    config: sub.config,
    schedule: sub.config.schedule,
    name: sub.name,
    sendAt: sendAtStr,
    nextSendAt: nextSendAt?.toISOString(),
    messageId: `subscribe_${sub.id}_${sendAtStr}`
  }
}

/**
 * 订阅管理与调度、补偿、巡检一体化模块
 */
export class SubscriptionManager {
  private scheduler: Scheduler
  private redis?: Redis

  /**
   * 构造函数，初始化 scheduler 实例
   * @param mqConfig MQ连接信息（如url、用户名、密码等）
   */
  /**
   * @param mqConfig MQ连接信息
   * @param redis Redis实例（ioredis）
   */
  /**
   * @param mqConfig MQ连接信息
   * @param redisOptions Redis连接配置（ioredis 支持的 options）
   */
  constructor () {
    this.scheduler = new Scheduler()
  }

  async init ( mqConfig: SchedulerInitOptions, redisOptions: RedisOptions ) {
    const logger = getLogger()
    await this.scheduler.init( mqConfig )
    logger.info( { mqUrl: mqConfig.mqUrl }, '[订阅] 调度器已连接 MQ' )
    this.redis = new Redis( redisOptions )
    try {
      const pong = await this.redis.ping()
      logger.info( { pong }, '[订阅] Redis 连接成功' )
    } catch ( e ) {
      logger.error( { err: e instanceof Error ? e.message : String( e ) }, '[订阅] Redis 连接失败' )
      throw e
    }
  }

  /**
   * 获取分布式幂等锁
   * @param key redis key
   * @param ttl 过期秒数
   * @returns true=获得锁，false=已被占用
   */
  async acquireLock ( key: string, ttl = 120 ): Promise<boolean> {
    // 兼容所有 Redis 版本，类型安全
    if ( !this.redis ) {
      throw new Error( 'Redis instance is not initialized' )
    }
    const ok = await this.redis.setnx( key, '1' )
    if ( ok === 1 ) {
      await this.redis.expire( key, ttl )
      return true
    }
    return false
  }

  /**
   * 启动订阅（开启并发下一个周期消息）
   */
  async start ( subscriptionId: number ): Promise<void> {
    const logger = getLogger()
    await subscribeService.toggleEnabled( subscriptionId, true )
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( sub ) {
      logger.info( { subscriptionId: sub.id, name: sub.name }, '[订阅] 已开启订阅，准备调度下一个周期' )
      await this.sendNext( sub.id )
    }
  }

  /**
   * 关闭订阅（仅标记，消费端自动丢弃消息）
   */
  async stop ( subscriptionId: number ): Promise<void> {
    const logger = getLogger()
    await subscribeService.toggleEnabled( subscriptionId, false )
    logger.info( { subscriptionId }, '[订阅] 已暂停订阅' )
  }

  /**
   * 立即重发（立即执行一次）
   */
  async resend ( subscriptionId: number ): Promise<void> {
    const logger = getLogger()
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( sub ) {
      logger.info( { subscriptionId: sub.id, name: sub.name }, '[订阅] 立即重发一次' )
      await this.sendNow( sub.id )
    }
  }

  /**
   * 获取订阅状态
   */
  async getStatus ( subscriptionId: number ): Promise<'active' | 'paused'> {
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( !sub ) return 'paused'
    return sub.enabled ? 'active' : 'paused'
  }

  /**
   * 批量调度所有订阅（服务启动时调用）
   */
  async scheduleBatch (): Promise<void> {
    const logger = getLogger()
    const { data: subscriptions } = await subscribeService.findAll( { page: 1, pageSize: 9999, bypassAuth: true } )
    logger.info( { total: subscriptions.length }, '[订阅] 启动批量调度' )
    for ( const sub of subscriptions ) {
      if ( !sub.enabled || !sub.config?.schedule ) continue
      try {
        const interval = CronExpressionParser.parse( sub.config.schedule )
        const next = interval.next().toDate()
        const msg = buildSubscriptionMessage( sub, next )
        // 发送端加redis锁，防止多实例重复调度
        const lockKey = `sub:send:${msg.messageId}`
        const locked = await this.acquireLock( lockKey, 120 )
        if ( !locked ) continue
        await this.scheduler.sendMessage( {
          type: 'subscription',
          payload: msg,
          deliverAt: next
        } )
        logger.info( { subscriptionId: sub.id, nextAt: next.toISOString(), name: sub.name }, '[订阅] 已调度下一个周期' )
      } catch ( e ) {}
    }
  }

  /**
   * 按指定时间补发（用于补偿/巡检）
   */
  async sendAt ( subscriptionId: number, sendAt: Date ): Promise<void> {
    const logger = getLogger()
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( !sub ) return
    const msg = buildSubscriptionMessage( sub, sendAt )
    // 发送端加redis锁，防止多实例重复调度/补偿
    const lockKey = `sub:send:${msg.messageId}`
    const locked = await this.acquireLock( lockKey, 120 )
    if ( !locked ) return
    await this.scheduler.sendMessage( {
      type: 'subscription',
      payload: msg,
      deliverAt: sendAt
    } )
    logger.info( { subscriptionId: sub.id, sendAt: sendAt.toISOString(), name: sub.name }, '[订阅] 已补发指定时间点' )
  }

  /**
   * 立即执行（用于手动触发）
   */
  async sendNow ( subscriptionId: number ): Promise<void> {
    const logger = getLogger()
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( !sub ) return
    const now = new Date()
    const msg = buildSubscriptionMessage( sub, now )
    const lockKey = `sub:send:${msg.messageId}`
    const locked = await this.acquireLock( lockKey, 120 )
    if ( !locked ) return
    await this.scheduler.sendMessage( {
      type: 'subscription',
      payload: msg
    } )
    logger.info( { subscriptionId: sub.id, name: sub.name }, '[订阅] 已立即发送一次' )
  }

  /**
   * 动态调度下一个周期（消费端自动调用）
   */
  async sendNext ( subscriptionId: number ): Promise<void> {
    const logger = getLogger()
    const sub = await subscribeService.findById( subscriptionId, { bypassAuth: true } )
    if ( !sub?.config?.schedule ) return
    try {
      const interval = CronExpressionParser.parse( sub.config.schedule )
      const next = interval.next().toDate()
      const msg = buildSubscriptionMessage( sub, next )
      const lockKey = `sub:send:${msg.messageId}`
      const locked = await this.acquireLock( lockKey, 120 )
      if ( !locked ) return
      await this.scheduler.sendMessage( {
        type: 'subscription',
        payload: msg,
        deliverAt: next
      } )
      logger.info( { subscriptionId: sub.id, nextAt: next.toISOString(), name: sub.name }, '[订阅] 已调度下一个周期' )
    } catch ( e ) {}
  }

  /**
   * 巡检所有订阅，发现未消费则自动补发
   */
  async inspectAllSubscriptions (): Promise<InspectResult[]> {
    const { data: subscriptions } = await subscribeService.findAll( { page: 1, pageSize: 9999 } )
    const results: InspectResult[] = []
    const now = new Date()
    for ( const sub of subscriptions ) {
      if ( !sub.enabled || !sub.config?.schedule ) continue
      let interval
      try {
        interval = CronExpressionParser.parse( sub.config.schedule )
      } catch ( e ) {
        results.push( { subscriptionId: sub.id, missed: true, reason: 'cron error', action: 'none' } )
        continue
      }
      // 只检查当前时间之前的最近一次调度点
      let lastPoint: Date | null = null
      try {
        interval.reset( now )
        lastPoint = interval.prev().toDate()
      } catch ( e ) {
        continue
      }
      // 只补发未被消费且已过期的调度点
      if ( lastPoint && lastPoint < now ) {
        const consumed = await SubscriptionManager.isMessageConsumed( sub, lastPoint )
        if ( !consumed ) {
          await this.sendAt( sub.id, lastPoint )
          results.push( { subscriptionId: sub.id, missed: true, reason: `not consumed at ${lastPoint.toISOString()}`, action: 'resend' } )
        } else {
          results.push( { subscriptionId: sub.id, missed: false, action: 'none' } )
        }
      }
    }
    return results
  }

  /**
   * 启动定时巡检任务，默认每10分钟执行一次
   */
  startSubscriptionInspector (): () => void {
    const logger = getLogger()
    let job: CronJob | null = null
    job = new CronJob( '*/10 * * * *', async () => {
      try {
        const results = await this.inspectAllSubscriptions()
        const missed = results.filter( r => r.missed ).length
        logger.info( { total: results.length, missed }, '[订阅] 巡检完成' )
      } catch ( e ) {
        logger.error( { err: e instanceof Error ? e.message : String( e ) }, '[订阅] 巡检异常' )
      }
    } )
    job.start()
    logger.info( '[订阅] 启动巡检任务（每10分钟）' )
    return () => {
      if ( job ) job.stop()
    }
  }

  /**
   * 判断某调度点是否已消费
   */
  static async isMessageConsumed ( subscription: Subscription, sendAt: Date ): Promise<boolean> {
    const msg = buildSubscriptionMessage( subscription, sendAt )
    return messageConsumeLogService.isConsumed( 'subscription', msg.messageId )
  }

  /**
   * 消费端入口，负责消息幂等消费、推送、自动调度下一个周期
   */
  async consumeAll (): Promise<void> {
    const logger = getLogger()
    this.scheduler.subscribe( {
      type: 'subscription',
      handler: async ( payload: unknown ) => {
        const msg = payload as SubscriptionMessage
        const lockKey = `sub:consume:${msg.messageId}`
        const locked = await this.acquireLock( lockKey, 300 )
        if ( !locked ) return // 消费端幂等锁，防止多实例重复消费
        let consumeResult: ConsumeResult | undefined
        try {
          // 幂等校验，防止重复消费
          const alreadyConsumed = await messageConsumeLogService.isConsumed( 'subscription', msg.messageId )
          if ( alreadyConsumed ) return

          // 校验订阅状态
          const sub = await subscribeService.findById( msg.subscriptionId, { bypassAuth: true } )
          if ( !sub || !sub.enabled ) return

          // 获取所有通知渠道ID
          const notifyIds = Array.isArray( sub.notifyIds ) ? sub.notifyIds : []

          // 获取订阅截图（如有异常则忽略）
          let screenshot: Buffer | null = null
          try {
            const host = process.env.NODE_ENV === 'production' ? 'http://localhost:80' : process.env.WEB_URL || 'http://localhost:5173'
            screenshot = await subscribeService.getSubscriptionScreenshot( sub.id, host )
          } catch ( e ) {
            screenshot = null
          }

          // 组装推送内容并发送到各个通知渠道
          const notifyResults: Array<{ notifyId: string; success: boolean; message?: string }> = []
          for ( const notifyId of notifyIds ) {
            const instance = await notifyService.getInstance( notifyId )!
            if ( !instance ) {
              notifyResults.push( { notifyId: String( notifyId ), success: false, message: 'Notification instance not found' } )
              continue
            }

            try {
              if ( screenshot ) {
                await instance.sendImage( {
                  title: `订阅【${sub.name}】`,
                  desc: msg.messageId,
                  images: [{ base64: screenshot.toString( 'base64' ), filename: `${msg.messageId}.png` }]
                } )
                notifyResults.push( { notifyId: String( notifyId ), success: true } )
              } else {
                await instance.sendText( `订阅【${sub.name}】定时推送` )
                notifyResults.push( { notifyId: String( notifyId ), success: true } )
              }
            } catch ( e ) {
              notifyResults.push( { notifyId: String( notifyId ), success: false, message: e instanceof Error ? e.message : String( e ) } )
            }
          }
          const success = notifyResults.every( r => r.success )

          // 消费完成后自动调度下一个周期
          let nextScheduleResult: { success: boolean, error?: unknown } = { success: true }
          try {
            await this.sendNext( sub.id )
          } catch ( e ) {
            nextScheduleResult = { success: false, error: e }
          }

          // 记录本次消费结果，写入消费日志
          consumeResult = {
            notifyResults,
            success,
            nextScheduleResult
          }
          await messageConsumeLogService.logConsume( 'subscription', msg.messageId, msg.subscriptionId )

          // 仅保留重要日志：消费失败时输出
          if ( !success ) {
            logger.error( { subscriptionId: sub.id, messageId: msg.messageId, notifyResults }, '[订阅] 消费失败' )
          } else {
            logger.info( { subscriptionId: sub.id, messageId: msg.messageId }, '[订阅] 消费完成' )
          }
        } catch ( err ) {
          // 仅保留异常日志
          logger.error( { messageId: msg?.messageId, err: err instanceof Error ? err.message : String( err ), consumeResult }, '[订阅] 消费异常' )
        }
      }
    } )
    logger.info( '[订阅] 已开始消费消息' )
  }
}
