import { filterCascadePublishedDocuments } from './publish-subtree.util';

describe('filterCascadePublishedDocuments', () => {
  it('skips explicitly unpublished branches and their descendants', () => {
    const subtree = [
      { id: 'root', parentDocument: undefined, publicAccessOverride: undefined },
      { id: 'child-a', parentDocument: { id: 'root' }, publicAccessOverride: undefined },
      { id: 'child-b', parentDocument: { id: 'root' }, publicAccessOverride: 'unpublished' },
      { id: 'grandchild-a', parentDocument: { id: 'child-a' }, publicAccessOverride: undefined },
      { id: 'grandchild-b', parentDocument: { id: 'child-b' }, publicAccessOverride: undefined },
    ];

    expect(filterCascadePublishedDocuments(subtree as never)).toEqual([
      subtree[0],
      subtree[1],
      subtree[3],
    ]);
  });
});
