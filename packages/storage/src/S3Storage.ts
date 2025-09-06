import { AbstractStorage, UploadOptions } from './AbstractStorage'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export interface S3StorageOptions {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint?: string
  region?: string
  publicUrl?: string
}

export class S3Storage extends AbstractStorage {
  private client: S3Client
  private bucket: string
  private publicUrl?: string

  constructor (options: S3StorageOptions) {
    super()
    this.bucket = options.bucket
    this.publicUrl = options.publicUrl
    this.client = new S3Client({
      region: options.region || 'us-east-1',
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      }
    })
  }

  async upload (options: UploadOptions): Promise<string> {
    const key = options.filepath ? `${options.filepath}/${options.filename}` : options.filename
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: options.content,
      ContentType: options.contentType
    }))
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`
  }
}
