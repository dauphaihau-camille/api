import { Injectable } from '@nestjs/common';
import type * as Yjs from 'yjs';
import { normalizeTitle } from '../utils/document-title.util';
import { DocumentCollaborationProjector } from '../ports/document-collaboration-projector';

@Injectable()
export class DocumentBlockNoteProjectorService extends DocumentCollaborationProjector {
  private editorPromise?: Promise<EditorContext>;

  async createDocument(content: unknown[], title: string): Promise<Yjs.Doc> {
    return (await this.getEditor()).createDocument(content, title);
  }

  async project(document: Yjs.Doc): Promise<{ content: unknown[]; title: string }> {
    return (await this.getEditor()).project(document);
  }

  private getEditor(): Promise<EditorContext> {
    this.editorPromise ??= createEditorContext();
    return this.editorPromise;
  }
}

type EditorContext = {
  createDocument: (content: unknown[], title: string) => Yjs.Doc;
  project: (document: Yjs.Doc) => { content: unknown[]; title: string };
};

async function createEditorContext(): Promise<EditorContext> {
  const blockNote = await import('@blocknote/core');
  const yjsUtilities = await import('@blocknote/core/yjs');

  const subdocBlockSpec = blockNote.createBlockSpec({
    type: 'subdoc',
    propSchema: {
      documentId: { default: '' },
      publicId: { default: '' },
      workspaceId: { default: '' },
      publishedDocumentId: { default: '' },
      title: { default: 'Untitled' },
      hasContent: { default: false },
    },
    content: 'none',
  }, {
    render() {
      return { dom: document.createElement('div') };
    },
  });

  const schema = blockNote.BlockNoteSchema.create().extend({
    blockSpecs: {
      subdoc: subdocBlockSpec(),
    },
  });
  const editor = blockNote.BlockNoteEditor.create({ schema });

  return {
    createDocument(content, title) {
      const document = yjsUtilities.blocksToYDoc(editor, content as never[]);

      document.getMap('meta').set('title', normalizeTitle(title));

      return document;
    },
    project(document) {
      return {
        content: yjsUtilities.yDocToBlocks(editor, document),
        title: normalizeTitle(document.getMap('meta').get('title') as string | undefined),
      };
    },
  };
}
