import { AbstractConnector, NotifyImagePayload } from '../abstract'
import axios from 'axios'
import FormData from 'form-data'
import { NotifyChannel } from '../../types'

export interface DiscordProperties {
  botToken: string
  channelId: string
}

export default class DiscordConnector extends AbstractConnector<DiscordProperties> {
  version = '1.0.0'

  constructor (properties: DiscordProperties) {
    super(NotifyChannel.Discord, properties)
  }

  public async test (): Promise<void> {
    await this.sendText('test')
  }

  public async sendText (text: string): Promise<void> {
    await this.discordPost({ content: text })
  }

  public async sendMarkdown (data: { text: string }): Promise<void> {
    await this.sendText(data.text)
  }

  /**
   * 发送图片消息，支持图片 URL 或本地 buffer
   */
  public async sendImage (data: NotifyImagePayload): Promise<void> {
    if (!data.images?.length) return
    const embedImages: { url: string, title?: string }[] = []
    for (const img of data.images) {
      if (img.url) {
        embedImages.push({ url: img.url, title: data.title || undefined })
      } else if (img.base64) {
        const uploadedUrl = await this.uploadImage(img)
        if (uploadedUrl) {
          embedImages.push({ url: uploadedUrl, title: data.title || undefined })
        }
      }
    }
    if (embedImages.length) {
      await this.discordPost({
        content: data.title || '',
        embeds: embedImages.map(img => ({ image: { url: img.url } }))
      })
    }
  }

  /**
   * 统一处理 Discord API 响应，主动抛出业务异常（如 code 字段）
   */
  private async discordPost (payload: Record<string, unknown>) {
    const { botToken, channelId } = this.properties
    try {
      const resp = await axios.post(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        payload,
        { headers: { Authorization: `Bot ${botToken}` } }
      )
      // Discord API 业务异常通常返回 code 字段
      if (resp.data && typeof resp.data === 'object' && 'code' in resp.data && resp.data.code !== 0) {
        throw new Error(`Discord API Error: code=${resp.data.code}, message=${resp.data.message || ''}`)
      }
      return resp
    } catch (err: unknown) {
      // axios 层异常
      if (
        typeof err === 'object' && err !== null &&
        'response' in err &&
        (err as { response?: { data?: { code?: unknown, message?: string } } }).response?.data?.code
      ) {
        const resp = (err as { response: { data: { code?: unknown, message?: string } } }).response
        throw new Error(`Discord API Error: code=${String(resp.data.code)}, message=${resp.data.message || ''}`)
      }
      throw err
    }
  }
}
