import { AbstractStorage, UploadOptions } from './AbstractStorage'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export interface R2StorageOptions {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
  region?: string
  publicUrl?: string // 用于拼接外链
}

export class R2Storage extends AbstractStorage {
  private client: S3Client
  private bucket: string
  private publicUrl?: string

  constructor (options: R2StorageOptions) {
    super()
    this.bucket = options.bucket
    this.publicUrl = options.publicUrl
    this.client = new S3Client({
      region: options.region || 'auto',
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      },
      forcePathStyle: true // R2 必须
    })
  }

  async upload (options: UploadOptions): Promise<string> {
    const key = options.filepath ? `${options.filepath}/${options.filename}` : options.filename
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: options.content,
        ContentType: options.contentType
      }))
    } catch (err) {
      // 打印详细日志
      console.error('[R2Storage] 上传失败:', {
        bucket: this.bucket,
        key,
        contentType: options.contentType,
        endpoint: this.client.config.endpoint,
        error: err
      })
      throw err
    }
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`
    }
    // 默认拼接 R2 S3 API 外链
    return `${this.client.config.endpoint}/${this.bucket}/${key}`
  }
}
