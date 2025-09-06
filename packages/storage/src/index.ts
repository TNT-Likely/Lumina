import { R2Storage } from './R2Storage'
import { S3Storage } from './S3Storage'
import { OSSStorage } from './OSSStorage'
import { AbstractStorage, UploadOptions } from './AbstractStorage'

export * from './AbstractStorage'
export * from './R2Storage'
export * from './S3Storage'
export * from './OSSStorage'

// 延迟初始化，避免在导入阶段就因未加载 .env 抛错
let storage: AbstractStorage | null = null

export class StorageConfigError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'StorageConfigError'
  }
}

function buildStorageFromEnv (): AbstractStorage {
  const type = process.env.STORAGE_TYPE
  if (type === 'r2') {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
      throw new StorageConfigError('R2 config incomplete: require R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET,R2_ENDPOINT')
    }
    return new R2Storage({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
      endpoint: process.env.R2_ENDPOINT!,
      publicUrl: process.env.R2_PUBLIC_URL
    })
  }
  if (type === 's3') {
    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_BUCKET) {
      throw new StorageConfigError('S3 config incomplete: require S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,S3_BUCKET')
    }
    return new S3Storage({
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      publicUrl: process.env.S3_PUBLIC_URL
    })
  }
  if (type === 'oss') {
    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET || !process.env.OSS_BUCKET || !process.env.OSS_REGION) {
      throw new StorageConfigError('OSS config incomplete: require OSS_ACCESS_KEY_ID,OSS_ACCESS_KEY_SECRET,OSS_BUCKET,OSS_REGION')
    }
    return new OSSStorage({
      accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
      bucket: process.env.OSS_BUCKET!,
      region: process.env.OSS_REGION!,
      publicUrl: process.env.OSS_PUBLIC_URL
    })
  }
  throw new StorageConfigError('Unknown STORAGE_TYPE, must be r2|s3|oss')
}

export function getStorage (): AbstractStorage {
  if (!storage) {
    storage = buildStorageFromEnv()
  }
  return storage
}

/**
 * 上传文件并返回外链地址
 */
export async function uploadFile (options: UploadOptions): Promise<string> {
  return getStorage().upload(options)
}
