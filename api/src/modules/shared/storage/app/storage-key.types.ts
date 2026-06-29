export type StorageVisibility = 'public' | 'private';

export interface BuildStorageObjectKeyInput {
  env?: string;
  visibility: StorageVisibility;
  scope: string[];
  segments?: string[];
  filename: string;
  extension: string;
}
