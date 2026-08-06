import {
  buildRealisticLeafContent,
  buildRealisticParentContent,
} from './realistic.seed';

describe('realistic seed content builders', () => {
  it('builds realistic leaf content with headings and paragraphs', () => {
    const content = buildRealisticLeafContent({
      title: 'Search Quality Spec',
      summary: 'Scope and rollout plan for AI search.',
      kind: 'spec',
    });

    expect(content).toEqual([
      {
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Search Quality Spec' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Scope and rollout plan for AI search.' }],
      },
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Objective' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Current Signal' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Decision Needed' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Next Actions' }],
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
          key: 'release-runbook',
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
