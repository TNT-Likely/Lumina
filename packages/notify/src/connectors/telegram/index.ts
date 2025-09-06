// 兼容 data:image/png;base64, 前缀和纯 base64
import type { NotifyImagePayload } from '../abstract'
import { AbstractConnector } from '../abstract'
import axios from 'axios'
import FormData from 'form-data'
import { Buffer } from 'buffer'
import { NotifyChannel } from '../../types'

export interface TelegramProperties {
  botToken: string
  chatId: string | number
}

export default class TelegramConnector extends AbstractConnector<TelegramProperties> {
  version = '1.0.0'

  constructor (properties: TelegramProperties) {
    super(NotifyChannel.Telegram, properties)
  }

  public async sendImage (data: NotifyImagePayload): Promise<void> {
    const { botToken, chatId } = this.properties
    const images = data.images || []
    if (!images.length) throw new Error('No image provided')
    const caption = [data.title, data.desc].filter(Boolean).join('\n')
    // sendMediaGroup 支持最多10张
    if (images.length === 1) {
      // 单图兼容原有逻辑
      const img = images[0]
      if (img.url) {
        const resp = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          chat_id: chatId,
          photo: img.url,
          caption
        })
        if (resp.data && resp.data.ok === false) {
          throw new Error(`Telegram API error: ${resp.data.description || JSON.stringify(resp.data)}`)
        }
        return
      }
      if (img.base64) {
        const form = new FormData()
        const buffer = Buffer.from(this.getPureBase64(img.base64), 'base64')
        form.append('chat_id', chatId)
        form.append('caption', caption)
        form.append('photo', buffer, {
          filename: img.filename || 'image.png',
          contentType: 'image/png'
        })
        const resp = await axios.post(
          `https://api.telegram.org/bot${botToken}/sendPhoto`,
          form,
          { headers: form.getHeaders() }
        )
        if (resp.data && resp.data.ok === false) {
          throw new Error(`Telegram API error: ${resp.data.description || JSON.stringify(resp.data)}`)
        }
        return
      }
      throw new Error('Image must have url or base64')
    }
    // 多图 sendMediaGroup
    const form = new FormData()
    form.append('chat_id', chatId)
    const media: Array<{ type: 'photo', media: string, caption?: string }> = []
    images.slice(0, 10).forEach((img, idx) => {
      if (img.url) {
        const m: { type: 'photo', media: string, caption?: string } = {
          type: 'photo',
          media: img.url
        }
        if (idx === 0 && caption) m.caption = caption
        media.push(m)
      } else if (img.base64) {
        const buffer = Buffer.from(this.getPureBase64(img.base64), 'base64')
        const attachName = `attach${idx}`
        form.append(attachName, buffer, {
          filename: img.filename || `image${idx + 1}.png`,
          contentType: 'image/png'
        })
        const m: { type: 'photo', media: string, caption?: string } = {
          type: 'photo',
          media: `attach://${attachName}`
        }
        if (idx === 0 && caption) m.caption = caption
        media.push(m)
      } else {
        throw new Error('Image must have url or base64')
      }
    })
    form.append('media', JSON.stringify(media))
    const resp = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMediaGroup`,
      form,
      { headers: form.getHeaders() }
    )
    if (resp.data && resp.data.ok === false) {
      throw new Error(`Telegram API error: ${resp.data.description || JSON.stringify(resp.data)}`)
    }
  }

  public async test (): Promise<void> {
    await this.sendText('test')
  }

  public async sendText (text: string): Promise<void> {
    const { botToken, chatId } = this.properties
    const resp = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text
    })
    if (resp.data && resp.data.ok === false) {
      throw new Error(`Telegram API error: ${resp.data.description || JSON.stringify(resp.data)}`)
    }
  }

  public async sendMarkdown (data: { text: string }): Promise<void> {
    const { botToken, chatId } = this.properties
    const resp = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: data.text,
      parse_mode: 'Markdown'
    })
    if (resp.data && resp.data.ok === false) {
      throw new Error(`Telegram API error: ${resp.data.description || JSON.stringify(resp.data)}`)
    }
  }
}
