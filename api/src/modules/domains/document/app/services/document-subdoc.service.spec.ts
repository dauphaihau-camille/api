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
        type: 'subdoc',
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
        type: 'subdoc',
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
        type: 'subdoc',
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
      type: 'subdoc',
      props: {
        documentId: 'child-2',
        publicId: 'public-child-2',
        workspaceId: 'workspace-1',
        title: 'Child 2',
        hasContent: false,
      },
      children: [],
    });
  });

  it('appends a duplicated child subdoc block only once', () => {
    const duplicatedDocument = {
      id: 'child-2',
      publicId: 'public-child-2',
      title: 'Child 2',
      workspace: { id: 'workspace-1' },
    };
    const content = [
      {
        id: 'block-1',
        type: 'subdoc',
        props: {
          documentId: 'child-1',
          publicId: 'public-child-1',
          title: 'Child 1',
        },
        children: [],
      },
    ];

    const result = service.appendSubdocBlock(content, duplicatedDocument as never);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-2',
        publicId: 'public-child-2',
        workspaceId: 'workspace-1',
        title: 'Child 2',
        hasContent: false,
      },
      children: [],
    });

    expect(
      service.appendSubdocBlock(result, duplicatedDocument as never),
    ).toBe(result);
  });

  it('replaces an empty anchor paragraph block with the new subdoc block', () => {
    const childDocument = {
      id: 'child-2',
      publicId: 'public-child-2',
      title: 'Child 2',
      workspace: { id: 'workspace-1' },
    };
    const content = [
      {
        id: 'empty-paragraph',
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [],
      },
      {
        id: 'block-2',
        type: 'paragraph',
        content: [{ type: 'text', text: 'After' }],
      },
    ];

    const result = service.insertSubdocBlock(
      content,
      childDocument as never,
      'empty-paragraph',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-2',
        publicId: 'public-child-2',
        workspaceId: 'workspace-1',
        title: 'Child 2',
      },
    });
    expect(result[1]).toEqual(content[1]);
  });

  it('inserts a new subdoc block after a non-empty anchor paragraph block', () => {
    const childDocument = {
      id: 'child-2',
      publicId: 'public-child-2',
      title: 'Child 2',
      workspace: { id: 'workspace-1' },
    };
    const content = [
      {
        id: 'filled-paragraph',
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        id: 'block-2',
        type: 'paragraph',
        content: [{ type: 'text', text: 'After' }],
      },
    ];

    const result = service.insertSubdocBlock(
      content,
      childDocument as never,
      'filled-paragraph',
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(content[0]);
    expect(result[1]).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-2',
      },
    });
    expect(result[2]).toEqual(content[1]);
  });

  it('replaces a persisted slash command paragraph when slash command text matches', () => {
    const childDocument = {
      id: 'child-2',
      publicId: 'public-child-2',
      title: 'Child 2',
      workspace: { id: 'workspace-1' },
    };
    const content = [
      {
        id: 'slash-command-block',
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [{ type: 'text', text: '/doc' }],
      },
    ];

    const result = service.insertSubdocBlock(
      content,
      childDocument as never,
      'slash-command-block',
      '/doc',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-2',
      },
    });
  });

  it('replaces the only empty paragraph candidate when the anchor id is missing', () => {
    const childDocument = {
      id: 'child-2',
      publicId: 'public-child-2',
      title: 'Child 2',
      workspace: { id: 'workspace-1' },
    };
    const content = [
      {
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [],
      },
    ];

    const result = service.insertSubdocBlock(
      content,
      childDocument as never,
      'missing-anchor-id',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-2',
        publicId: 'public-child-2',
      },
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
        type: 'subdoc',
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
            id: 'nested-subdoc',
            type: 'subdoc',
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
