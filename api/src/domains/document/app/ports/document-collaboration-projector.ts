import type * as Yjs from 'yjs';

export type DocumentCollaborationProjection = {
  content: unknown[];
  title: string;
};

export abstract class DocumentCollaborationProjector {
  abstract createDocument(content: unknown[], title: string): Promise<Yjs.Doc>;
  abstract project(document: Yjs.Doc): Promise<DocumentCollaborationProjection>;
}
