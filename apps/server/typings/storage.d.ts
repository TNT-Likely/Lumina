declare module '@lumina/storage' {
  export function uploadFile (options: { filename: string; filepath?: string; content: Buffer | string; contentType?: string }): Promise<string>
}
