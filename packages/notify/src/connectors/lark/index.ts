import { AbstractConnector } from '../abstract'
import axios from 'axios'
import { NotifyChannel } from '../../types'
import CryptoJS from 'crypto-js'

export interface LarkProperties {
  webhook: string
  secret?: string
}

export default class LarkConnector extends AbstractConnector<LarkProperties> {
  /**
   * 发送图片，支持 images[].url/base64/filename，自动上传为公网链接
   */
  public async sendImage (data: { images: Array<{ url?: string; base64?: string; filename?: string }>; title?: string; desc?: string }): Promise<void> {
    const imageLinks: string[] = []
    for (const img of data.images || []) {
      const url = img.url ? img.url : await this.uploadImage(img)
      if (url) imageLinks.push(url)
    }
    if (imageLinks.length > 0) {
      await this.larkSend({
        msg_type: 'image',
        content: {
          image_key: '',
          image_url: imageLinks[0]
        }
      })
    }
  }

  version = '1.0.0'

  constructor (properties: LarkProperties) {
    super(NotifyChannel.Lark, properties)
  }

  public async test (): Promise<void> {
    await this.sendText('test')
  }

  public async sendText (text: string): Promise<void> {
    await this.larkSend({ msg_type: 'text', content: { text } })
  }

  public async sendMarkdown (data: { text: string }): Promise<void> {
    await this.larkSend({
      msg_type: 'post',
      content: { post: { zh_cn: { title: '通知', content: [[{ tag: 'text', text: data.text }]] } } }
    })
  }

  /**
   * 统一安全发送，自动拼接 access_token、签名参数
   */
  private async larkSend (data: Record<string, unknown>): Promise<void> {
    const url = this.properties.webhook
    const { secret } = this.properties
    let body = data
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const stringToSign = `${timestamp}\n${secret}`
      // Go/Java示例：密钥用stringToSign，消息体为空
      const hmac = CryptoJS.HmacSHA256('', stringToSign)
      const sign = CryptoJS.enc.Base64.stringify(hmac)
      body = { ...data, timestamp: timestamp.toString(), sign }
    }
    try {
      const res = await axios.post(url, body)
      if (res.data && res.data.code !== 0) {
        throw new Error(`飞书发送失败: code=${res.data.code}, msg=${res.data.msg || res.data.message || ''}`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }
}
