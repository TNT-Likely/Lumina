import { AbstractConnector, NotifyImagePayload } from '../abstract'
import axios from 'axios'
import { NotifyChannel } from '../../types'

export interface SlackProperties {
  botToken?: string; // bot token 方式
  channel?: string; // 频道或用户ID，必填
  clientId?: string; // 用于 token 刷新
  clientSecret?: string; // 用于 token 刷新
  refreshToken?: string; // 用于 token 刷新
}

export default class SlackConnector extends AbstractConnector<SlackProperties> {
  /**
   * 通用的 Slack 消息发送，自动处理 token 失效重试
   */
  private async slackPostWithTokenRetry (payload: Record<string, unknown>): Promise<void> {
    let token = await this.getAccessToken()
    if (!token || !this.properties.channel) return
    try {
      const resp = await axios.post('https://slack.com/api/chat.postMessage', {
        channel: this.properties.channel,
        ...payload
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (resp.data && resp.data.ok === false) {
        throw new Error(`Slack API error: ${resp.data.error || JSON.stringify(resp.data)}`)
      }
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err && (err as { response?: { status?: number } }).response?.status === 401) {
        token = await this.refreshToken()
        const resp = await axios.post('https://slack.com/api/chat.postMessage', {
          channel: this.properties.channel,
          ...payload
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resp.data && resp.data.ok === false) {
          throw new Error(`Slack API error: ${resp.data.error || JSON.stringify(resp.data)}`)
        }
      } else {
        throw err
      }
    }
  }

  private _accessToken: string | undefined
  private _refreshing: Promise<string> | null = null

  version = '1.0.0'

  constructor (properties: SlackProperties) {
    super(NotifyChannel.Slack, properties)
  }

  public async test (): Promise<void> {
    await this.sendText('test')
  }

  /**
   * 发送文本消息，支持 webhook 和 bot token
   */
  public async sendText (text: string): Promise<void> {
    await this.slackPostWithTokenRetry({ text })
  }

  public async sendMarkdown (data: { text: string }): Promise<void> {
    await this.sendText(data.text)
  }

  /**
   * 获取可用 access token，自动刷新
   */
  private async getAccessToken (): Promise<string | undefined> {
    // 优先用内存中的 token
    if (this._accessToken) return this._accessToken
    if (this.properties.botToken) return this.properties.botToken
    // 自动刷新
    if (this.properties.refreshToken && this.properties.clientId && this.properties.clientSecret) {
      if (this._refreshing) return this._refreshing
      this._refreshing = this.refreshToken()
      const token = await this._refreshing
      this._refreshing = null
      return token
    }
    return undefined
  }

  /**
   * 刷新 access token
   */
  private async refreshToken (): Promise<string> {
    const resp = await axios.post('https://slack.com/api/oauth.v2.access', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.properties.refreshToken!,
      client_id: this.properties.clientId!,
      client_secret: this.properties.clientSecret!
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    if (resp.data && resp.data.access_token) {
      this._accessToken = resp.data.access_token
      // 可选：this.properties.refreshToken = resp.data.refresh_token
      return resp.data.access_token
    }
    throw new Error('Failed to refresh Slack access token: ' + JSON.stringify(resp.data))
  }

  /**
   * 发送图片（支持 bot token 方式上传本地图片，webhook 仅支持图片URL）
   * @param data { images: [{ url?: string, base64?: string, filename?: string }] }
   */
  public async sendImage (data: NotifyImagePayload): Promise<void> {
    const imageLinks: string[] = []
    for (const img of data.images || []) {
      const url = img.url ? img.url : await this.uploadImage(img)
      if (url) imageLinks.push(url)
    }
    if (imageLinks.length > 0) {
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: data.title || '图片' } },
        ...imageLinks.map(link => ({
          type: 'image',
          image_url: link,
          alt_text: '图片'
        }))
      ]
      await this.slackPostWithTokenRetry({ text: data.text || '图片', blocks })
    }
  }
}
