import { type NotifyChannel } from '../../types'
import { uploadFile } from '@lumina/storage'
export interface NotifyImagePayload {
  images: Array<{ url?: string; base64?: string, filename?: string }>
  title?: string
  desc?: string
  template?: string
  [extra: string]: unknown
}

export abstract class AbstractConnector<
  Properties extends object,
> {
  readonly type: NotifyChannel
  readonly properties: Properties

  abstract readonly version: string

  constructor (type: NotifyChannel, properties: Properties) {
    this.type = type
    this.properties = properties
  }

  public abstract test (): Promise<void>
  public abstract sendText (text: string): Promise<void>
  public abstract sendMarkdown (data: { text: string }): Promise<void>
  public abstract sendImage (data: NotifyImagePayload): Promise<void>

  protected async uploadImage (img: { base64?: string, filename?: string }): Promise<string | undefined> {
    let fileData: Buffer | undefined
    // 生成随机文件名，保留原扩展名
    let ext = 'png'
    if (img.filename && img.filename.includes('.')) {
      ext = img.filename.split('.').pop() || 'png'
    }
    const randomName = `lumina-content/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    if (img.base64) {
      // let base64 = img.base64
      // // 兼容 data:image/png;base64, 前缀
      // const matched = base64.match(/^data:([\w/+.-]+);base64,(.*)$/)
      // if (matched) {
      //   base64 = matched[2]
      // }
      fileData = Buffer.from(this.getPureBase64(img.base64), 'base64')
    } else {
      return undefined
    }
    // 根据扩展名推断 contentType
    let contentType = 'image/png'
    if (['jpg', 'jpeg'].includes(ext.toLowerCase())) contentType = 'image/jpeg'
    else if (ext.toLowerCase() === 'gif') contentType = 'image/gif'
    else if (ext.toLowerCase() === 'webp') contentType = 'image/webp'
    else if (ext.toLowerCase() === 'svg') contentType = 'image/svg+xml'
    // 使用 @lumina/storage 上传
    return uploadFile({ filename: randomName, content: fileData, contentType })
  }

  protected getPureBase64 (str: string): string {
    const matched = str.match(/^data:[\w/+.-]+;base64,(.*)$/)
    return matched ? matched[1] : str
  }
}
