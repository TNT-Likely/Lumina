import { getApiClient } from '../index'

export interface UploadResult { url: string, filename: string }

export const UploadApi = {
  async upload ( file: File | Blob, options?: { category?: string, filename?: string, contentType?: string } ): Promise<UploadResult> {
    const fd = new FormData()
    // 文件字段名与后端 ctx.getFileStream 约定为 file
    const fileName = options?.filename || ( file instanceof File ? file.name : 'file' )
    const inferredType = file instanceof File ? file.type : options?.contentType
    const f = new File( [file], fileName, { type: options?.contentType || inferredType } )
    fd.append( 'file', f )
    if ( options?.category ) fd.append( 'category', options.category )
    const client = getApiClient()
    const resp = await client.requestRaw<UploadResult>( '/api/upload', {
      method: 'POST',
      data: fd,
      headers: { 'Content-Type': 'multipart/form-data' }
    } )
    if ( !resp.success ) throw new Error( resp.message || '上传失败' )
    return resp.data!
  }
}
