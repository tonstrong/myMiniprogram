export interface FileStorageAdapter {
  createUploadUrl: (payload: unknown) => Promise<string>;
}
