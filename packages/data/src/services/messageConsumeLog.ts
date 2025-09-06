import MessageConsumeLog from '../models/messageConsumeLog'
import { Op, type WhereOptions } from 'sequelize'

export const messageConsumeLogService = {
  /**
   * 记录消费日志
   */
  async logConsume ( type: string, messageId: string, refId: number ): Promise<void> {
    await MessageConsumeLog.create( {
      type,
      messageId,
      refId,
      consumedAt: new Date()
    } )
  },

  /**
   * 判断某 messageId 是否已被消费
   */
  async isConsumed ( type: string, messageId: string ): Promise<boolean> {
    const count = await MessageConsumeLog.count( { where: { type, messageId } } )
    return count > 0
  },

  /**
   * 查询某类型、某业务主键的消费日志
   */
  async findByRef ( type: string, refId: number, from?: Date, to?: Date ) {
    const where: WhereOptions = { type, refId }
    if ( from || to ) {
      // consumedAt 范围查询
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ;( where as Record<string, unknown> ).consumedAt = {
        ...( from ? { [Op.gte]: from } : {} ),
        ...( to ? { [Op.lte]: to } : {} )
      }
    }
    return await MessageConsumeLog.findAll( { where } )
  }
}
