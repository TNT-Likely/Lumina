import { AbstractStorage, UploadOptions } from './AbstractStorage'
// eslint-disable-next-line
const OSS = require('ali-oss')

export interface OSSStorageOptions {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
  publicUrl?: string
}

// 最小化的 ali-oss 客户端接口，避免引入 any
interface AliOssClientLike {
  put: (name: string, content: Buffer | string | ReadableStream | Blob | ArrayBuffer | Uint8Array, options?: Record<string, unknown>) => Promise<unknown>
}

export class OSSStorage extends AbstractStorage {
  private client: AliOssClientLike
  private region: string
  private bucket: string
  private publicUrl?: string

  constructor (options: OSSStorageOptions) {
    super()
    this.bucket = options.bucket
    this.publicUrl = options.publicUrl
    this.region = options.region
    this.client = new OSS({
      region: options.region,
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      bucket: options.bucket
    })
  }

  async upload (options: UploadOptions): Promise<string> {
    const key = options.filepath ? `${options.filepath}/${options.filename}` : options.filename
    await this.client.put(key, options.content)
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`
    }
    // 默认拼接阿里云 OSS 外链
    // ali-oss 没有公开 options，region 需手动保存
    return `https://${this.bucket}.${this.region}.aliyuncs.com/${key}`
  }
}
