import { connect, Connection, Channel, ConsumeMessage, Replies } from 'amqplib'
import { Buffer } from 'buffer'

export interface SchedulerInitOptions {
  mqUrl: string;
  queuePrefix?: string;
}

export interface SendMessageOptions<T> {
  type: string;
  payload: T;
  deliverAt?: Date;
}

export interface SubscribeOptions {
  type: string;
  handler: (payload: unknown) => Promise<void>;
}

export interface Scheduler {
  init(options: SchedulerInitOptions): Promise<void>;
  sendMessage<T>(options: SendMessageOptions<T>): Promise<void>;
  subscribe(options: SubscribeOptions): void;
  pause(type: string): Promise<void>;
  resume(type: string): Promise<void>;
}

class SchedulerImpl implements Scheduler {
  private connection: Connection | null = null

  private channel: Channel | null = null

  private queuePrefix = ''

  private consumers: Map<string, string> = new Map()

  async init (options: SchedulerInitOptions): Promise<void> {
    const connectionModel = await connect(options.mqUrl)
    this.connection = connectionModel.connection
    this.channel = await connectionModel.createChannel()
    this.queuePrefix = options.queuePrefix || ''
  }

  async sendMessage<T> (options: SendMessageOptions<T>): Promise<void> {
    if (!this.channel) throw new Error('Scheduler not initialized')
    const queue = this.getQueueName(options.type)
    await this.channel.assertQueue(queue, { durable: true })
    const msg = Buffer.from(JSON.stringify({
      payload: options.payload,
      deliverAt: options.deliverAt?.toISOString() || null,
      createdAt: new Date().toISOString()
    }))
    if (options.deliverAt && options.deliverAt.getTime() > Date.now()) {
      // 延迟消息实现：依赖 RabbitMQ 延迟插件 x-delayed-message
      await this.channel.assertExchange('delayed_exchange', 'x-delayed-message', {
        durable: true,
        arguments: { 'x-delayed-type': 'direct' }
      })
      await this.channel.bindQueue(queue, 'delayed_exchange', queue)
      this.channel.publish(
        'delayed_exchange',
        queue,
        msg,
        {
          headers: {
            'x-delay': options.deliverAt.getTime() - Date.now()
          },
          persistent: true
        }
      )
    } else {
      this.channel.sendToQueue(queue, msg, { persistent: true })
    }
  }

  subscribe (options: SubscribeOptions): void {
    if (!this.channel) throw new Error('Scheduler not initialized')
    const queue = this.getQueueName(options.type)
    this.channel.assertQueue(queue, { durable: true })
    const consume = async (msg: ConsumeMessage | null) => {
      if (!msg) return
      try {
        const data = JSON.parse(msg.content.toString())
        await options.handler(data.payload)
        this.channel!.ack(msg)
      } catch (e) {
        this.channel!.nack(msg, false, false) // 丢弃异常消息
      }
    }
    this.channel.consume(queue, consume).then((res: Replies.Consume) => {
      this.consumers.set(options.type, res.consumerTag)
    })
  }

  async pause (type: string): Promise<void> {
    if (!this.channel) throw new Error('Scheduler not initialized')
    const tag = this.consumers.get(type)
    if (tag) {
      await this.channel.cancel(tag)
      this.consumers.delete(type)
    }
  }

  async resume (type: string): Promise<void> {
    // 重新订阅，需业务方重新调用 subscribe
    // 这里可选实现自动恢复
  }

  private getQueueName (type: string): string {
    return this.queuePrefix ? `${this.queuePrefix}.${type}` : type
  }
}

export default SchedulerImpl
