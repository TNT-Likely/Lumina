import { AbstractConnector } from '../abstract'
import https from 'https'
import CryptoJS from 'crypto-js'
import { NotifyChannel } from '../../types'

export interface DingRobotProperties {
  accessToken: string
  secret?: string
}

export default class DingRobot extends AbstractConnector<DingRobotProperties> {
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
      const md = `${data.desc ? data.desc + '\n' : ''}${imageLinks.map(url => `![](${url})`).join('\n')}`
      await this.sendMarkdown({ text: md, title: data.title })
    }
  }

  version = '1.0.0'

  constructor (properties: DingRobotProperties) {
    super(NotifyChannel.Ding_Robot, properties)
  }

  private getSign (timestamp: number, secret: string): string {
    const sign = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(`${timestamp}\n${secret}`, secret)
    )
    return sign
  }

  private async send (data: Record<string, unknown>): Promise<void> {
    const { accessToken, secret } = this.properties
    if (accessToken == null) {
      await Promise.reject(new Error('缺少必要的token')); return
    }

    const postData = JSON.stringify(data)
    let chunkData = ''
    await new Promise((resolve, reject) => {
      let url = `/robot/send?access_token=${accessToken}`
      if (secret != null) {
        const timestamp = Date.now()
        const sign = this.getSign(timestamp, secret)
        url += `&timestamp=${timestamp}&sign=${sign}`
      }

      const req = https.request(
        {
          hostname: 'oapi.dingtalk.com',
          port: 443,
          path: url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        (res: unknown) => {
          const r = res as { on: (ev: string, cb: (d?: unknown) => void) => void }
          r.on('data', (d?: unknown) => {
            if (typeof d === 'string' || d instanceof Buffer) {
              chunkData += d.toString()
            }
          })

          r.on('end', () => {
            let result: unknown
            try {
              result = JSON.parse(chunkData)
            } catch (e) {}
            if (result && typeof result === 'object' && 'errcode' in result && (result as { errcode: number }).errcode === 0) {
              resolve(result)
            } else {
              reject(new Error(chunkData))
            }
          })
        }
      )
      req.write(postData)
      req.end()
    })
  }

  public async test (): Promise<void> {
    await this.sendText('hello')
  }

  public async sendText (content: string): Promise<void> {
    await this.send({
      msgtype: 'text',
      text: {
        content
      }
    })
  }

  /** https://open.dingtalk.com/document/orgapp/message-types-and-data-format#title-afc-2nh-5kk */
  public async sendMarkdown (data: {
    text: string
    title?: string
    atAll?: boolean
    atMobiles?: string[]
  }): Promise<void> {
    const { text, title, atAll, atMobiles } = data
    await this.send({
      msgtype: 'markdown',
      markdown: {
        text,
        title: title == null ? '标题' : title
      },
      at: {
        atMobiles,
        isAtAll: atAll
      }
    })
  }
}
