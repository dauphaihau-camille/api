import type { DocumentBlueprint } from '../fixtures/realistic.types';
import type { SeedDocumentSummary } from './realistic-seed.types';
import { buildSeededPublicId } from './shared.seed';

type TextBlock = {
  type: 'paragraph' | 'heading';
  props?: Record<string, unknown>;
  content: Array<{ type: 'text'; text: string }>;
};

export function paragraph(text: string): TextBlock {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

export function heading(text: string, level: 1 | 2 | 3 = 2): TextBlock {
  return {
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text }],
  };
}

export function buildSubpageBlock(input: {
  documentId: string;
  publicId: string;
  workspaceId: string;
  title: string;
}): unknown {
  return {
    id: buildSeededPublicId(`subdoc:${input.documentId}`),
    type: 'subdoc',
    props: {
      documentId: input.documentId,
      publicId: input.publicId,
      workspaceId: input.workspaceId,
      title: input.title,
    },
    children: [],
  };
}

export function buildRealisticLeafContent(input: {
  summary: string;
  kind: DocumentBlueprint['kind'];
}): unknown[] {
  const focusLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Use this page as the quick entry point for AI roadmap, launch, evaluation, and customer signal work.',
    hub: 'This hub groups the working pages that the team opens most often during AI product reviews.',
    spec: 'Capture the problem, scope, user impact, model behavior, permissions, and rollout decisions here.',
    notes: 'Write concise notes, decisions, customer evidence, and open follow-ups after each review.',
    runbook: 'Keep operational steps explicit so another teammate can run the AI workflow without guesswork.',
    roadmap: 'Summarize the quarter priorities, tradeoffs, sequencing, and confidence behind the AI roadmap.',
    wiki: 'Document stable background context that new teammates need before changing prompts, models, or policies.',
    tracker: 'Track ownership, status, confidence, and next actions in a lightweight shared format.',
  };
  const signalLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Current signal: search quality, launch readiness, and customer feedback are reviewed twice a week.',
    hub: 'Current signal: the linked pages hold the latest decisions, owners, and unresolved risks.',
    spec: 'Current signal: the team is validating measurable answer quality before broad rollout.',
    notes: 'Current signal: decisions are stable, but follow-up owners should refresh status before the next demo.',
    runbook: 'Current signal: the workflow is ready for staging and needs one final owner pass before production use.',
    roadmap: 'Current signal: Q3 bets are ordered by customer impact, quality confidence, and implementation risk.',
    wiki: 'Current signal: this is shared context for reviewers who need a quick but reliable system overview.',
    tracker: 'Current signal: several items are moving from discovery into launch-readiness review.',
  };
  const actionLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Next action: review the linked priority pages and update stale owners before taking screenshots.',
    hub: 'Next action: open each related page, resolve unclear ownership, and archive work that is no longer active.',
    spec: 'Next action: confirm success metrics, acceptance criteria, and the narrowest launch scope.',
    notes: 'Next action: convert unresolved discussion points into tracked owners or explicit decisions.',
    runbook: 'Next action: run the checklist in staging, capture failures, and note the rollback owner.',
    roadmap: 'Next action: verify sequencing against capacity, dependencies, and customer commitments.',
    wiki: 'Next action: keep terminology, examples, and linked decisions current as the AI system changes.',
    tracker: 'Next action: move blocked rows forward by naming the next concrete owner action.',
  };

  return [
    paragraph(input.summary),
    heading('Objective', 3),
    paragraph(focusLineByKind[input.kind]),
    heading('Current Signal', 3),
    paragraph(signalLineByKind[input.kind]),
    heading('Decision Needed', 3),
    paragraph('Decide whether this work is ready for launch review, needs another evaluation pass, or should stay in discovery.'),
    heading('Next Actions', 3),
    paragraph(actionLineByKind[input.kind]),
  ];
}

export function buildRealisticParentContent(input: {
  summary: string;
  kind: DocumentBlueprint['kind'];
  childDocuments: SeedDocumentSummary[];
}): unknown[] {
  return [
    ...buildRealisticLeafContent({
      summary: input.summary,
      kind: input.kind,
    }),
    heading('Related Pages', 3),
    ...input.childDocuments.map((childDocument) =>
      buildSubpageBlock({
        documentId: childDocument.id,
        publicId: childDocument.publicId,
        workspaceId: childDocument.workspaceId,
        title: childDocument.title,
      })),
  ];
}
