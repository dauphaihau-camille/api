import { DocumentSubdocService } from './document-subdoc.service';

describe('DocumentSubdocService', () => {
  const service = new DocumentSubdocService({} as never);

  it('replaces duplicated subdoc references in content', () => {
    const duplicatedDocument = {
      id: 'duplicated-1',
      publicId: 'public-duplicated-1',
      title: 'Duplicated doc',
    };
    const content = [
      {
        id: 'block-1',
        type: 'subpage',
        props: {
          documentId: 'original-1',
          publicId: 'public-original-1',
          title: 'Original doc',
        },
        children: [],
      },
    ];

    const result = service.replaceSubdocReferencesInContent(
      content,
      new Map([['original-1', duplicatedDocument as never]]),
    );

    expect(result).toEqual([
      {
        id: 'block-1',
        type: 'subpage',
        props: {
          documentId: 'duplicated-1',
          publicId: 'public-duplicated-1',
          title: 'Duplicated doc',
        },
        children: [],
      },
    ]);
  });

  it('appends missing child subdoc blocks without duplicating referenced children', () => {
    const parentDocument = { id: 'parent-1' };
    const duplicatedDocuments = [
      {
        id: 'child-1',
        publicId: 'public-child-1',
        title: 'Child 1',
        workspace: { id: 'workspace-1' },
        parentDocument: { id: 'parent-1' },
      },
      {
        id: 'child-2',
        publicId: 'public-child-2',
        title: 'Child 2',
        workspace: { id: 'workspace-1' },
        parentDocument: { id: 'parent-1' },
      },
    ];
    const content = [
      {
        id: 'block-1',
        type: 'subpage',
        props: {
          documentId: 'child-1',
          publicId: 'public-child-1',
          title: 'Child 1',
        },
        children: [],
      },
    ];

    const result = service.appendMissingChildSubdocBlocks(
      content,
      parentDocument as never,
      duplicatedDocuments as never,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(content[0]);
    expect(result[1]).toMatchObject({
      type: 'subpage',
      props: {
        documentId: 'child-2',
        publicId: 'public-child-2',
        workspaceId: 'workspace-1',
        title: 'Child 2',
      },
      children: [],
    });
  });

  it('removes archived subdoc blocks from content', () => {
    const content = [
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        children: [
          {
            text: 'Before',
          },
        ],
      },
      {
        id: 'block-2',
        type: 'subpage',
        props: {
          documentId: 'child-1',
          publicId: 'public-child-1',
          title: 'Child 1',
        },
        children: [],
      },
      {
        id: 'block-3',
        type: 'paragraph',
        props: {},
        children: [
          {
            id: 'nested-subpage',
            type: 'subpage',
            props: {
              documentId: 'child-2',
              publicId: 'public-child-2',
              title: 'Child 2',
            },
            children: [],
          },
        ],
      },
    ];

    const result = service.removeSubdocBlocksFromContent(
      content,
      new Set(['child-1', 'child-2']),
    );

    expect(result.changed).toBe(true);
    expect(result.content).toEqual([
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        children: [
          {
            text: 'Before',
          },
        ],
      },
      {
        id: 'block-3',
        type: 'paragraph',
        props: {},
        children: [],
      },
    ]);
  });
});
