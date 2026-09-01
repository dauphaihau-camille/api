import type { EntityManager } from '@mikro-orm/postgresql';
import { AiChatTurnEntity } from '../../../src/domains/ai-assistance/infra/persistence/entities/ai-chat-turn.entity';
import { AiConversationSessionEntity } from '../../../src/domains/ai-assistance/infra/persistence/entities/ai-conversation-session.entity';
import { AiDocumentAttachmentEntity } from '../../../src/domains/ai-assistance/infra/persistence/entities/ai-document-attachment.entity';
import { normalizeCompletedAiResponse } from '../../../src/domains/ai-assistance/app/services/ai-response-normalizer';
import { UserEntity } from '../../../src/domains/user/infra/persistence/entities/user.entity';
import { DocumentEntity } from '../../../src/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';

type AiChatSeedUser = {
  id: string;
  email: string;
};

type AiChatSeedDocument = {
  key: string;
  id: string;
  title: string;
};

type AiChatSeedTurn = {
  userMessage: string;
  assistantResponse: string;
  documentKeys?: string[];
};

type AiChatSeedSession = {
  title?: string | null;
  userEmail: string;
  lastActivityAt: Date;
  turns: AiChatSeedTurn[];
  countsTowardUsage?: boolean;
};

const SEEDED_AI_CHAT_TITLES = [
  'Launch readiness summary',
  'Evaluation risks review',
  'Customer signal synthesis',
  'Long pagination history',
  'Account health recap',
  'GTM launch brief',
  'Northstar GTM review',
  'Northstar customer intelligence',
] as const;

function buildLongAiChatTurns(): AiChatSeedTurn[] {
  const phases = [
    'retrieval coverage',
    'permission-aware citations',
    'answer confidence states',
    'append-to-document flow',
    'customer rollout messaging',
    'evaluation regression triage',
  ];

  return Array.from({ length: 86 }, (_value, index) => {
    const phase = phases[index % phases.length]!;
    const turnNumber = index + 1;

    return {
      userMessage: `Review checkpoint ${turnNumber}: what should we verify for ${phase}?`,
      assistantResponse: [
        `Checkpoint ${turnNumber} should verify ${phase} against the current workspace evidence.`,
        'Confirm the assistant cites only accessible documents, preserves user intent, and avoids adding unsupported launch claims.',
        'If the answer will be appended into a planning doc, keep the output structured as concise bullets with explicit owners and risks.',
      ].join(' '),
      documentKeys: index % 3 === 0
        ? ['launch-brief', 'assistant-ux']
        : index % 3 === 1
          ? ['retrieval-tests', 'release-runbook']
          : ['customer-signals', 'beta-feedback'],
    };
  });
}

function buildAiChatSeedSessions(templateKey: string, memberUsers: AiChatSeedUser[]): AiChatSeedSession[] {
  const userEmails = new Set(memberUsers.map((memberUser) => memberUser.email));
  const hasUser = (email: string) => userEmails.has(email);

  if (templateKey === 'acme-product' && hasUser('maya.chen@example.com')) {
    return [
      {
        title: 'Launch readiness summary',
        userEmail: 'maya.chen@example.com',
        lastActivityAt: new Date(Date.UTC(2026, 6, 2, 14, 30)),
        turns: [
          {
            userMessage: 'Summarize launch readiness for the AI Product team in five bullets.',
            assistantResponse: 'Launch readiness is strongest around the Q3 roadmap, prompt library, and assistant UX scope. Remaining risks are concentrated in retrieval quality, append-to-document polish, and customer-facing rollout proof. The team should keep the Launch Brief as the source of truth, use Beta Feedback for objections, and verify Tool Use Rules before enabling action-oriented demos.',
            documentKeys: ['launch-brief', 'roadmap', 'assistant-ux'],
          },
          {
            userMessage: 'What should Maya call out in the demo narrative?',
            assistantResponse: 'Lead with the workspace assistant staying grounded in existing documents, then show a focused summary from Launch Brief, a retrieval-backed follow-up from Search Quality Spec, and a safe append into Weekly Brief. Close by naming the permission boundary so reviewers see that restricted evaluation notes are not exposed accidentally.',
            documentKeys: ['launch-brief', 'docs-search-spec', 'weekly-highlights'],
          },
        ],
      },
      {
        title: 'Evaluation risks review',
        userEmail: 'maya.chen@example.com',
        lastActivityAt: new Date(Date.UTC(2026, 6, 2, 10, 15)),
        turns: [
          {
            userMessage: 'List the top evaluation risks before enabling streamed AI answers.',
            assistantResponse: 'The top risks are stale retrieval snippets, missing citations on synthesized recommendations, inconsistent refusal copy, and silent permission regressions. Eval Runbook should cover the promotion checklist, Retrieval Tests should cover empty and restricted states, and Regression Notes should track known failures until the next scorecard pass.',
            documentKeys: ['release-runbook', 'retrieval-tests', 'incident-review'],
          },
          {
            userMessage: 'Turn that into a short release-gate checklist.',
            assistantResponse: 'Release gate: run the golden retrieval set, verify restricted teamspace answers as a viewer, confirm streamed deltas reconcile to the persisted final turn, test append-to-document on a real planning page, and record any model behavior changes in Model Release Notes.',
            documentKeys: ['architecture', 'model-release-notes'],
          },
        ],
      },
      {
        title: null,
        userEmail: 'maya.chen@example.com',
        lastActivityAt: new Date(Date.UTC(2026, 6, 1, 16, 45)),
        turns: [],
      },
      {
        title: 'Long pagination history',
        userEmail: 'maya.chen@example.com',
        lastActivityAt: new Date(Date.UTC(2026, 6, 3, 9, 0)),
        countsTowardUsage: false,
        turns: buildLongAiChatTurns(),
      },
    ];
  }

  if (templateKey === 'northwind-ops') {
    const sessions: AiChatSeedSession[] = [];

    if (hasUser('nina.patel@example.com')) {
      sessions.push(
        {
          title: 'Account health recap',
          userEmail: 'nina.patel@example.com',
          lastActivityAt: new Date(Date.UTC(2026, 6, 2, 13, 10)),
          turns: [
            {
              userMessage: 'Summarize the account health themes for the launch-room review.',
              assistantResponse: 'The strongest account health theme is that champions want clearer rollout sequencing and faster synthesis of customer objections. The GTM team should connect Account Health with Customer Signals, then use Launch Room notes to separate launch blockers from messaging follow-ups.',
              documentKeys: ['account-health', 'expansion-signals', 'delivery-handbook'],
            },
            {
              userMessage: 'What follow-up should Omar own?',
              assistantResponse: 'Omar should own the customer-intelligence follow-up: validate the top three objections, add evidence links to the rollout brief, and confirm which accounts need a high-touch enablement note before the next launch checkpoint.',
              documentKeys: ['success-playbook', 'exec-summary'],
            },
          ],
        },
        {
          title: 'GTM launch brief',
          userEmail: 'nina.patel@example.com',
          lastActivityAt: new Date(Date.UTC(2026, 6, 1, 11, 0)),
          turns: [
            {
              userMessage: 'Draft a concise GTM launch brief from the current notes.',
              assistantResponse: 'Position the launch around faster customer signal synthesis, safer internal knowledge access, and clearer account-level next actions. Keep the brief focused on rollout confidence: target users, readiness signals, top objections, launch owners, and measurable follow-up after the first customer wave.',
              documentKeys: ['enablement-plan', 'ops-home'],
            },
          ],
        },
      );
    }

    if (hasUser('maya.chen@example.com')) {
      sessions.push(
        {
          title: 'Northstar GTM review',
          userEmail: 'maya.chen@example.com',
          lastActivityAt: new Date(Date.UTC(2026, 6, 2, 15, 20)),
          turns: [
            {
              userMessage: 'I am helping review Northstar GTM AI. What are the launch-readiness gaps?',
              assistantResponse: 'Northstar looks ready for a GTM review, but the launch gaps are account prioritization, support readiness, and clear owner handoff after implementation. Use Account Health for customer risk, Launch Room for implementation blockers, and Enablement Plan for training coverage before presenting the workspace.',
              documentKeys: ['account-health', 'delivery-handbook', 'enablement-plan'],
            },
            {
              userMessage: 'Give me a concise handoff note for the Camille product team.',
              assistantResponse: 'Handoff note: GTM teams need faster synthesis of account health, expansion signals, and support themes. The product team should validate citation clarity, restricted-document behavior, and whether follow-up recommendations can be copied into implementation docs without losing source context.',
              documentKeys: ['expansion-signals', 'support-themes', 'handoff-notes'],
            },
          ],
        },
        {
          title: 'Northstar customer intelligence',
          userEmail: 'maya.chen@example.com',
          lastActivityAt: new Date(Date.UTC(2026, 6, 1, 12, 35)),
          turns: [
            {
              userMessage: 'Summarize customer intelligence signals for a product-readout slide.',
              assistantResponse: 'Customer intelligence signals cluster around onboarding clarity, champion enablement, and permission confidence. The product-readout should connect Success Playbook evidence with Renewal Notes and Champion Map so the team can separate product gaps from enablement gaps.',
              documentKeys: ['success-playbook', 'renewal-notes', 'champion-map'],
            },
          ],
        },
      );
    }

    return sessions;
  }

  return [];
}

export async function seedAiConversationSessions(input: {
  em: EntityManager;
  workspaceId: string;
  templateKey: string;
  memberUsers: AiChatSeedUser[];
  documents: AiChatSeedDocument[];
}): Promise<{ countedResponses: number }> {
  const sessions = buildAiChatSeedSessions(input.templateKey, input.memberUsers);
  const turnCount = sessions.reduce((count, session) => count + session.turns.length, 0);
  const expectedAttachmentCount = sessions.reduce(
    (count, session) => count + session.turns.reduce(
      (turnTotal, turn) => turnTotal + (turn.documentKeys?.length ?? 0),
      0,
    ),
    0,
  );
  const countedResponses = sessions.reduce((count, session) => {
    if (session.countsTowardUsage === false) {
      return count;
    }

    return count + session.turns.length;
  }, 0);

  if (sessions.length === 0) {
    console.log(`[seed][realistic][ai] Skipped ${input.templateKey}; no AI chat scenario matched seeded members`);
    return { countedResponses: 0 };
  }

  const userByEmail = new Map(input.memberUsers.map((user) => [user.email, user]));
  const documentByKey = new Map(input.documents.map((document) => [document.key, document]));
  const seededUsers = [...new Map(sessions.flatMap((session) => {
    const user = userByEmail.get(session.userEmail);

    return user ? [[user.id, user] as const] : [];
  })).values()];

  for (const user of seededUsers) {
    const existingSessions = await input.em.find(AiConversationSessionEntity, {
      workspace: input.workspaceId,
      user: user.id,
      $or: [
        { title: { $in: [...SEEDED_AI_CHAT_TITLES] } },
        { title: null },
      ],
    });

    if (existingSessions.length > 0) {
      input.em.remove(existingSessions);
    }
  }

  await input.em.flush();
  let attachmentCount = 0;
  for (const sessionSeed of sessions) {
    const user = userByEmail.get(sessionSeed.userEmail);

    if (!user) {
      continue;
    }

    const session = input.em.create(AiConversationSessionEntity, {
      workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
      user: input.em.getReference(UserEntity, user.id),
      title: sessionSeed.title ?? undefined,
      lastActivityAt: sessionSeed.lastActivityAt,
    });
    session.createdAt = new Date(sessionSeed.lastActivityAt.getTime() - ((sessionSeed.turns.length + 1) * 60_000));
    session.updatedAt = sessionSeed.lastActivityAt;
    input.em.persist(session);
    for (const [turnIndex, turnSeed] of sessionSeed.turns.entries()) {
      const createdAt = new Date(sessionSeed.lastActivityAt.getTime() - ((sessionSeed.turns.length - turnIndex) * 60_000));
      const turn = input.em.create(AiChatTurnEntity, {
        session,
        userMessage: turnSeed.userMessage,
        assistantResponse: turnSeed.assistantResponse,
        responseBlockPayload: normalizeCompletedAiResponse(turnSeed.assistantResponse),
        status: 'completed',
        metadata: {
          scenario: 'realistic-ai-chat',
          documentKeys: turnSeed.documentKeys ?? [],
        },
      });
      turn.createdAt = createdAt;
      turn.updatedAt = createdAt;
      input.em.persist(turn);

      for (const documentKey of turnSeed.documentKeys ?? []) {
        const document = documentByKey.get(documentKey);

        if (!document) {
          continue;
        }

        const attachment = input.em.create(AiDocumentAttachmentEntity, {
          turn,
          document: input.em.getReference(DocumentEntity, document.id),
          title: document.title,
        });
        attachment.createdAt = createdAt;
        attachment.updatedAt = createdAt;
        input.em.persist(attachment);
        attachmentCount += 1;
      }
    }
  }

  await input.em.flush();

  console.log(
    `[seed][realistic][ai] Seeded ${input.templateKey}: ${sessions.length} sessions for ${seededUsers.map((user) => user.email).join(', ')}, ${turnCount} turns, ${countedResponses} counted responses, ${attachmentCount}/${expectedAttachmentCount} document attachments`,
  );
  return { countedResponses };
}
