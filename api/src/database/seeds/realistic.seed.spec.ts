import {
  buildRealisticLeafContent,
  buildRealisticParentContent,
} from '../../../database/seeds/realistic.seed';

describe('realistic seed content builders', () => {
  it('builds realistic leaf content with headings and paragraphs', () => {
    const content = buildRealisticLeafContent({
      title: 'Docs Search Spec',
      summary: 'Scope and rollout plan for search.',
      kind: 'spec',
    });

    expect(content).toEqual([
      {
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Docs Search Spec' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Scope and rollout plan for search.' }],
      },
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'What This Covers' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Current Notes' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
    ]);
  });

  it('appends subdoc blocks for child documents', () => {
    const content = buildRealisticParentContent({
      title: 'Engineering Hub',
      summary: 'Shared engineering entry point.',
      kind: 'hub',
      childDocuments: [
        {
          id: 'child-1',
          publicId: 'abcdefabcdefabcdefabcdefabcdefab',
          title: 'Release Runbook',
          workspaceId: 'workspace-1',
        },
      ],
    });

    expect(content.at(-1)).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-1',
        publicId: 'abcdefabcdefabcdefabcdefabcdefab',
        workspaceId: 'workspace-1',
        title: 'Release Runbook',
      },
      children: [],
    });
  });
});
