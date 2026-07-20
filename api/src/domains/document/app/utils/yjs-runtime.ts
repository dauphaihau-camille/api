import { createRequire } from 'node:module';
import type * as Yjs from 'yjs';

type YjsModule = typeof Yjs;

const requireYjs = createRequire(__filename);

let yjsModulePromise: Promise<YjsModule> | undefined;

export function loadYjs(): Promise<YjsModule> {
  if (!yjsModulePromise) {
    yjsModulePromise = process.env.JEST_WORKER_ID
      ? Promise.resolve(requireYjs('yjs') as YjsModule)
      : import('yjs');
  }

  return yjsModulePromise;
}
