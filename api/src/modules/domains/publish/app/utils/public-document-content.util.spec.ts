import {
  collectReferencedSubdocIds,
  withPublishedSubdocTargets,
} from './public-document-content.util';

describe('public-document-content util', () => {
  const content = [
    {
      id: '1',
      type: 'paragraph',
      children: [],
    },
    {
      id: '2',
      type: 'subpage',
      props: {
        documentId: 'child-1',
        title: 'Child 1',
      },
      children: [],
    },
    {
      id: '3',
      type: 'bulletListItem',
      children: [
        {
          id: '4',
          type: 'subpage',
          props: {
            documentId: 'child-2',
            title: 'Child 2',
          },
          children: [],
        },
      ],
    },
  ];

  it('collects referenced subdoc ids from nested blocks', () => {
    expect(collectReferencedSubdocIds(content)).toEqual(['child-1', 'child-2']);
  });

  it('adds published share targets to subpage props', () => {
    const nextContent = withPublishedSubdocTargets(
      content,
      new Map([
        ['child-1', 'published-child-1'],
      ]),
    ) as Array<{
      props?: Record<string, unknown>;
      children?: Array<{ props?: Record<string, unknown> }>;
    }>;

    expect(nextContent[1]?.props?.publishedDocumentId).toBe('published-child-1');
    expect(nextContent[2]?.children?.[0]?.props?.publishedDocumentId).toBe('');
  });
});
