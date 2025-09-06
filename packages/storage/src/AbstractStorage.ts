export interface UploadOptions {
  filename: string;
  filepath?: string;
  content: Buffer | string;
  contentType?: string;
}

export abstract class AbstractStorage {
  /**
   * 上传文件
   * @param options 文件上传参数
   * @returns 上传后可访问的完整 URL
   */
  abstract upload(options: UploadOptions): Promise<string>;
}
