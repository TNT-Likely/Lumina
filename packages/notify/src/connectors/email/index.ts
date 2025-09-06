import { AbstractConnector } from '../abstract'
import nodemailer from 'nodemailer'
import { NotifyChannel } from '../../types'

export interface EmailProperties {
  host: string
  port: number
  secure?: boolean
  from: string
  user: string
  pass: string
  to: string | string[]
}

export default class EmailConnector extends AbstractConnector<EmailProperties> {
  public async sendImage (data: import('../abstract').NotifyImagePayload): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.properties.host,
      port: this.properties.port,
      secure: this.properties.secure,
      auth: {
        user: this.properties.user,
        pass: this.properties.pass
      }
    })
    const images = data.images || []

    const attachments = images.map((img, idx) => {
      if (img.base64) {
        return {
          filename: img.filename || `image${idx + 1}.png`,
          content: Buffer.from(this.getPureBase64(img.base64), 'base64'),
          cid: `img${idx}`
        }
      } else if (img.url) {
        return {
          filename: img.filename || `image${idx + 1}.png`,
          path: img.url,
          cid: `img${idx}`
        }
      }
      return null
    }).filter(Boolean)
    let html = ''
    if (data.title) html += `<h3>${data.title}</h3>`
    if (data.desc) html += `<p>${data.desc}</p>`
    if (attachments.length > 0) {
      html += attachments.map(a => `<img src="cid:${a!.cid}" style="max-width:100%"><br/>`).join('')
    }
    await transporter.sendMail({
      from: this.properties.from,
      to: this.properties.to,
      subject: data.title || '图片通知',
      html,
      attachments: attachments as Array<{ filename: string, content?: Buffer, path?: string, cid: string }>
    })
  }

  version = '1.0.0'

  constructor (properties: EmailProperties) {
    super(NotifyChannel.Email, properties)
  }

  public async test (): Promise<void> {
    await this.sendText('test')
  }

  public async sendText (text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.properties.host,
      port: this.properties.port,
      secure: this.properties.secure,
      auth: { user: this.properties.from, pass: this.properties.pass }
    })
    await transporter.sendMail({
      from: this.properties.from,
      to: this.properties.to,
      subject: '通知',
      text
    })
  }

  public async sendMarkdown (data: { text: string, subject?: string }): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.properties.host,
      port: this.properties.port,
      secure: this.properties.secure,
      auth: { user: this.properties.user, pass: this.properties.pass }
    })
    await transporter.sendMail({
      from: this.properties.from,
      to: this.properties.to,
      subject: data.subject || '通知',
      html: data.text
    })
  }
}
