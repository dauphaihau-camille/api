import { TeamspaceAccessMode } from '../../../src/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '../../../src/domains/teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';
import { DocumentAccessGrantPermission } from '../../../src/domains/document/domain/enums/document-access-grant-permission.enum';
import type {
  SeedUserFixture,
  WorkspaceTemplate,
} from './realistic.types';

export const REALISTIC_USER_FIXTURES: SeedUserFixture[] = [
  { email: 'maya.chen@example.com', displayName: 'Maya Chen', role: 'admin' },
  { email: 'jordan.lee@example.com', displayName: 'Jordan Lee', role: 'member' },
  { email: 'sofie.nguyen@example.com', displayName: 'Sofie Nguyen', role: 'member' },
  { email: 'alex.rivera@example.com', displayName: 'Alex Rivera', role: 'member' },
  { email: 'nina.patel@example.com', displayName: 'Nina Patel', role: 'member' },
  { email: 'omar.hassan@example.com', displayName: 'Omar Hassan', role: 'member' },
  { email: 'emily.tran@example.com', displayName: 'Emily Tran', role: 'member' },
  { email: 'daniel.kim@example.com', displayName: 'Daniel Kim', role: 'member' },
  { email: 'lucy.garcia@example.com', displayName: 'Lucy Garcia', role: 'member' },
];

export const REALISTIC_WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    key: 'acme-product',
    name: 'Camille AI',
    description: 'AI product, evaluation, and launch collaboration for the Camille assistant workspace.',
    members: [
      { email: 'admin@example.com', role: WorkspaceRole.OWNER },
      { email: 'maya.chen@example.com', role: WorkspaceRole.OWNER },
      { email: 'jordan.lee@example.com', role: WorkspaceRole.ADMIN },
      { email: 'sofie.nguyen@example.com', role: WorkspaceRole.MEMBER },
      { email: 'alex.rivera@example.com', role: WorkspaceRole.MEMBER },
      { email: 'member@example.com', role: WorkspaceRole.MEMBER },
    ],
    subscription: {
      state: 'plus_active',
      replicaStates: {
        2: 'plus_canceling',
      },
    },
    teamspaces: [
      {
        key: 'engineering',
        name: 'Model Evaluation',
        description: 'Eval scorecards, regression notes, retrieval tests, and model quality reviews.',
        accessMode: TeamspaceAccessMode.RESTRICTED,
        members: [
          { email: 'maya.chen@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'jordan.lee@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'sofie.nguyen@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
      {
        key: 'product',
        name: 'AI Product',
        description: 'Roadmap, launch briefs, prompt operations, and customer signal documents.',
        members: [
          { email: 'maya.chen@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'jordan.lee@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'alex.rivera@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
    ],
    documents: [
      {
        key: 'home',
        title: 'AI Home',
        kind: 'landing',
        summary: 'Shared entry point for roadmap, launch readiness, model quality, and customer signal work.',
        children: [
          {
            key: 'weekly-highlights',
            title: 'Weekly Brief',
            kind: 'notes',
            summary: 'Wins, risks, decisions, and next actions across AI product and evaluation work.',
          },
          {
            key: 'launch-calendar',
            title: 'Launch Calendar',
            kind: 'tracker',
            summary: 'Milestones, launch owners, demo dates, and release confidence by assistant surface.',
          },
          {
            key: 'decision-log',
            title: 'Decision Log',
            kind: 'wiki',
            summary: 'Durable product and architecture decisions for the AI assistant roadmap.',
          },
          {
            key: 'demo-script',
            title: 'Demo Script',
            kind: 'notes',
            summary: 'Screenshot and walkthrough beats for the workspace assistant product demo.',
          },
        ],
      },
      {
        key: 'engineering-hub',
        title: 'Model Evaluation',
        kind: 'hub',
        summary: 'Starting point for answer quality, retrieval accuracy, and model regression work.',
        teamspaceKey: 'engineering',
        children: [
          {
            key: 'architecture',
            title: 'Eval Scorecard',
            kind: 'wiki',
            summary: 'Quality rubric for grounded answers, citation usefulness, tool-use accuracy, and refusal behavior.',
          },
          {
            key: 'release-runbook',
            title: 'Eval Runbook',
            kind: 'runbook',
            summary: 'Steps for running golden-set checks before promoting a model or retrieval change.',
          },
          {
            key: 'incident-review',
            title: 'Regression Notes',
            kind: 'notes',
            summary: 'Recent failures, owner notes, suspected causes, and mitigation status.',
          },
          {
            key: 'retrieval-tests',
            title: 'Retrieval Tests',
            kind: 'tracker',
            summary: 'Permission-aware search cases covering ranking, citations, stale docs, and empty states.',
          },
          {
            key: 'hallucination-cases',
            title: 'Hallucination Cases',
            kind: 'tracker',
            summary: 'Examples where the assistant overreached, missed citations, or inferred unsupported facts.',
          },
          {
            key: 'model-release-notes',
            title: 'Model Release Notes',
            kind: 'notes',
            summary: 'Observed behavior changes, known limitations, and rollback notes by model version.',
          },
        ],
      },
      {
        key: 'product-hub',
        title: 'AI Product',
        kind: 'hub',
        summary: 'Roadmap, prompt governance, launch messaging, and customer feedback for the AI assistant.',
        teamspaceKey: 'product',
        children: [
          {
            key: 'roadmap',
            title: 'Q3 Roadmap',
            kind: 'roadmap',
            summary: 'Sequenced investments across workspace search, summarization, permissions, and agent actions.',
          },
          {
            key: 'docs-search-spec',
            title: 'Search Quality Spec',
            kind: 'spec',
            summary: 'Improve answer quality with permission-aware retrieval, citation ranking, and feedback loops.',
          },
          {
            key: 'launch-brief',
            title: 'Launch Brief',
            kind: 'notes',
            summary: 'Positioning, target users, demo scenarios, success metrics, and launch readiness notes.',
          },
          {
            key: 'prompt-library',
            title: 'Prompt Library',
            kind: 'wiki',
            summary: 'Reviewed prompts for summaries, search answers, document drafting, and action suggestions.',
          },
          {
            key: 'tool-use-rules',
            title: 'Tool Use Rules',
            kind: 'spec',
            summary: 'Confirmation, permission, and audit requirements before agents act on workspace content.',
          },
          {
            key: 'beta-feedback',
            title: 'Beta Feedback',
            kind: 'tracker',
            summary: 'Customer quotes, usability pain points, feature requests, and follow-up owners from beta users.',
          },
          {
            key: 'assistant-ux',
            title: 'Assistant UX',
            kind: 'spec',
            summary: 'Interaction states for grounded answers, citations, suggestions, corrections, and feedback capture.',
          },
        ],
      },
      {
        key: 'security-review',
        title: 'Security Review',
        kind: 'hub',
        summary: 'Risk review for data access, prompt injection, audit logging, and customer trust requirements.',
        teamspaceKey: 'engineering',
        children: [
          {
            key: 'agent-permissions',
            title: 'Agent Permissions',
            kind: 'spec',
            summary: 'Policy matrix for which assistant actions require view, edit, manage, or explicit confirmation.',
          },
          {
            key: 'prompt-injection',
            title: 'Prompt Injection',
            kind: 'runbook',
            summary: 'Detection and response steps for malicious instructions inside workspace documents.',
          },
          {
            key: 'audit-log-review',
            title: 'Audit Log Review',
            kind: 'tracker',
            summary: 'Review checklist for assistant actions, user approvals, denied access, and suspicious retries.',
          },
        ],
      },
      {
        key: 'customer-signals',
        title: 'Customer Signals',
        kind: 'hub',
        summary: 'Voice-of-customer themes that shape AI assistant ranking, summarization, and launch priorities.',
        teamspaceKey: 'product',
        children: [
          {
            key: 'theme-board',
            title: 'Theme Board',
            kind: 'tracker',
            summary: 'Grouped customer feedback themes from beta interviews, support tickets, and sales calls.',
          },
          {
            key: 'persona-notes',
            title: 'Persona Notes',
            kind: 'notes',
            summary: 'Needs, anxieties, and success criteria for product managers, support leads, and operators.',
          },
          {
            key: 'sales-objections',
            title: 'Sales Objections',
            kind: 'notes',
            summary: 'Common objections about accuracy, permissions, privacy, onboarding, and governance.',
          },
        ],
      },
    ],
    documentAccessGrants: [
      {
        documentKey: 'weekly-highlights',
        userEmail: 'alex.rivera@example.com',
        permission: DocumentAccessGrantPermission.EDIT,
        grantedByEmail: 'maya.chen@example.com',
      },
      {
        documentKey: 'agent-permissions',
        userEmail: 'sofie.nguyen@example.com',
        permission: DocumentAccessGrantPermission.VIEW,
        grantedByEmail: 'maya.chen@example.com',
      },
    ],
    documentAccessSettings: [
      {
        documentKey: 'agent-permissions',
        workspaceMemberPermission: DocumentAccessGrantPermission.VIEW,
        updatedByEmail: 'maya.chen@example.com',
      },
    ],
  },
  {
    key: 'northwind-ops',
    name: 'Northstar GTM AI',
    description: 'Customer operations, delivery, and go-to-market playbooks for an AI rollout team.',
    members: [
      { email: 'member@example.com', role: WorkspaceRole.OWNER },
      { email: 'nina.patel@example.com', role: WorkspaceRole.OWNER },
      { email: 'omar.hassan@example.com', role: WorkspaceRole.ADMIN },
      { email: 'emily.tran@example.com', role: WorkspaceRole.MEMBER },
      { email: 'lucy.garcia@example.com', role: WorkspaceRole.MEMBER },
    ],
    subscription: {
      state: 'free',
      replicaStates: {
        2: 'plus_past_due',
      },
    },
    teamspaces: [
      {
        key: 'success',
        name: 'Customer Intelligence',
        description: 'Account plans, signal reviews, onboarding scripts, and AI adoption risks.',
        accessMode: TeamspaceAccessMode.RESTRICTED,
        members: [
          { email: 'nina.patel@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'omar.hassan@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'emily.tran@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
      {
        key: 'delivery',
        name: 'Launch Room',
        description: 'Implementation templates, launch plans, enablement, and customer handoff docs.',
        members: [
          { email: 'nina.patel@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'omar.hassan@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'lucy.garcia@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
    ],
    documents: [
      {
        key: 'ops-home',
        title: 'GTM Home',
        kind: 'landing',
        summary: 'Links to AI launch accounts, enablement docs, renewal risks, and weekly customer focus.',
        children: [
          {
            key: 'account-health',
            title: 'Account Health',
            kind: 'tracker',
            summary: 'Weekly review of AI adoption, red accounts, churn risk, and executive follow-up.',
          },
          {
            key: 'expansion-signals',
            title: 'Expansion Signals',
            kind: 'tracker',
            summary: 'Usage, champion feedback, integration requests, and renewal opportunities by account.',
          },
          {
            key: 'exec-summary',
            title: 'Exec Summary',
            kind: 'notes',
            summary: 'Leadership-ready snapshot of launch progress, blockers, and customer outcomes.',
          },
        ],
      },
      {
        key: 'success-playbook',
        title: 'Customer Intelligence',
        kind: 'hub',
        summary: 'Core onboarding, adoption, and renewal material used by the customer success team.',
        teamspaceKey: 'success',
        children: [
          {
            key: 'onboarding-plan',
            title: 'Onboarding Plan',
            kind: 'runbook',
            summary: 'Week-by-week onboarding plan for teams adopting AI search and assistant workflows.',
          },
          {
            key: 'renewal-notes',
            title: 'Renewal Notes',
            kind: 'notes',
            summary: 'Talking points, objections, usage evidence, and expansion opportunities before renewal.',
          },
          {
            key: 'champion-map',
            title: 'Champion Map',
            kind: 'tracker',
            summary: 'Buyer, champion, admin, and skeptic map for each active AI rollout account.',
          },
          {
            key: 'support-themes',
            title: 'Support Themes',
            kind: 'notes',
            summary: 'Recurring support questions about accuracy, permissions, model behavior, and onboarding.',
          },
        ],
      },
      {
        key: 'delivery-handbook',
        title: 'Launch Room',
        kind: 'hub',
        summary: 'Implementation process, risk register, enablement, and customer kickoff material.',
        teamspaceKey: 'delivery',
        children: [
          {
            key: 'kickoff-agenda',
            title: 'Kickoff Agenda',
            kind: 'notes',
            summary: 'Agenda and expected outcomes for AI assistant implementation kickoff.',
          },
          {
            key: 'implementation-spec',
            title: 'Implementation Scope',
            kind: 'spec',
            summary: 'Milestones, integrations, permissions, and non-goals for an AI assistant rollout.',
          },
          {
            key: 'enablement-plan',
            title: 'Enablement Plan',
            kind: 'runbook',
            summary: 'Training sessions, example workflows, admin prep, and adoption success checks.',
          },
          {
            key: 'launch-risks',
            title: 'Launch Risks',
            kind: 'tracker',
            summary: 'Risks around data readiness, policy review, stakeholder alignment, and support coverage.',
          },
          {
            key: 'handoff-notes',
            title: 'Handoff Notes',
            kind: 'notes',
            summary: 'Implementation context handed from delivery to success after the first production launch.',
          },
        ],
      },
    ],
    documentAccessGrants: [
      {
        documentKey: 'account-health',
        userEmail: 'omar.hassan@example.com',
        permission: DocumentAccessGrantPermission.EDIT,
        grantedByEmail: 'nina.patel@example.com',
      },
      {
        documentKey: 'ops-home',
        userEmail: 'lucy.garcia@example.com',
        permission: DocumentAccessGrantPermission.MANAGE,
        grantedByEmail: 'nina.patel@example.com',
      },
    ],
    documentAccessSettings: [
      {
        documentKey: 'account-health',
        workspaceMemberPermission: DocumentAccessGrantPermission.COMMENT,
        updatedByEmail: 'nina.patel@example.com',
      },
    ],
  },
];
