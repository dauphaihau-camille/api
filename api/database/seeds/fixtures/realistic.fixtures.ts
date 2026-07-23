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
    name: 'Acme Product',
    description: 'Product, engineering, and go-to-market collaboration for the Acme workspace.',
    members: [
      { email: 'admin@example.com', role: WorkspaceRole.OWNER },
      { email: 'maya.chen@example.com', role: WorkspaceRole.OWNER },
      { email: 'jordan.lee@example.com', role: WorkspaceRole.ADMIN },
      { email: 'sofie.nguyen@example.com', role: WorkspaceRole.MEMBER },
      { email: 'alex.rivera@example.com', role: WorkspaceRole.MEMBER },
      { email: 'member@example.com', role: WorkspaceRole.MEMBER },
    ],
    teamspaces: [
      {
        key: 'engineering',
        name: 'Engineering',
        description: 'Architecture notes, release checklists, and technical runbooks.',
        accessMode: TeamspaceAccessMode.RESTRICTED,
        members: [
          { email: 'maya.chen@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'jordan.lee@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'sofie.nguyen@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
      {
        key: 'product',
        name: 'Product',
        description: 'Specs, roadmap, and launch coordination documents.',
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
        title: 'Company Home',
        kind: 'landing',
        summary: 'Shared entry page with the most referenced planning docs.',
        children: [
          {
            key: 'weekly-highlights',
            title: 'Weekly Highlights',
            kind: 'notes',
            summary: 'Short summary of wins, risks, and decisions for the week.',
          },
          {
            key: 'launch-calendar',
            title: 'Launch Calendar',
            kind: 'tracker',
            summary: 'Milestones, launch owners, and current status by release.',
          },
        ],
      },
      {
        key: 'engineering-hub',
        title: 'Engineering Hub',
        kind: 'hub',
        summary: 'Starting point for architecture, incidents, and release operations.',
        teamspaceKey: 'engineering',
        children: [
          {
            key: 'architecture',
            title: 'Architecture Decisions',
            kind: 'wiki',
            summary: 'Decision log for data model, auth, and workspace architecture.',
          },
          {
            key: 'release-runbook',
            title: 'Release Runbook',
            kind: 'runbook',
            summary: 'Checklist for staging validation, rollout, and rollback.',
          },
          {
            key: 'incident-review',
            title: 'Incident Review Template',
            kind: 'notes',
            summary: 'Template for capture, analysis, and follow-up after incidents.',
          },
        ],
      },
      {
        key: 'product-hub',
        title: 'Product Planning',
        kind: 'hub',
        summary: 'Specs, roadmap, and launch messaging for active initiatives.',
        teamspaceKey: 'product',
        children: [
          {
            key: 'roadmap',
            title: 'Quarterly Roadmap',
            kind: 'roadmap',
            summary: 'Current quarter priorities with sequencing and dependencies.',
          },
          {
            key: 'docs-search-spec',
            title: 'Docs Search Spec',
            kind: 'spec',
            summary: 'Problem statement, goals, scope, and rollout plan for search.',
          },
          {
            key: 'launch-brief',
            title: 'Launch Brief',
            kind: 'notes',
            summary: 'Positioning, target audience, and readiness notes for launch.',
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
        documentKey: 'launch-calendar',
        userEmail: 'sofie.nguyen@example.com',
        permission: DocumentAccessGrantPermission.VIEW,
        grantedByEmail: 'maya.chen@example.com',
      },
    ],
    documentAccessSettings: [
      {
        documentKey: 'weekly-highlights',
        workspaceMemberPermission: DocumentAccessGrantPermission.VIEW,
        updatedByEmail: 'maya.chen@example.com',
      },
    ],
  },
  {
    key: 'northwind-ops',
    name: 'Northwind Operations',
    description: 'Customer operations and delivery playbooks for a services team.',
    members: [
      { email: 'member@example.com', role: WorkspaceRole.OWNER },
      { email: 'nina.patel@example.com', role: WorkspaceRole.OWNER },
      { email: 'omar.hassan@example.com', role: WorkspaceRole.ADMIN },
      { email: 'emily.tran@example.com', role: WorkspaceRole.MEMBER },
      { email: 'lucy.garcia@example.com', role: WorkspaceRole.MEMBER },
    ],
    teamspaces: [
      {
        key: 'success',
        name: 'Customer Success',
        description: 'Onboarding scripts, account plans, and risk reviews.',
        accessMode: TeamspaceAccessMode.RESTRICTED,
        members: [
          { email: 'nina.patel@example.com', role: TeamspaceMemberRole.MANAGER },
          { email: 'omar.hassan@example.com', role: TeamspaceMemberRole.EDITOR },
          { email: 'emily.tran@example.com', role: TeamspaceMemberRole.VIEWER },
        ],
      },
      {
        key: 'delivery',
        name: 'Delivery',
        description: 'Implementation templates, project plans, and handoff docs.',
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
        title: 'Operations Home',
        kind: 'landing',
        summary: 'Links to active accounts, templates, and current weekly focus.',
        children: [
          {
            key: 'account-health',
            title: 'Account Health Review',
            kind: 'tracker',
            summary: 'Weekly review of red accounts, churn risk, and executive follow-up.',
          },
        ],
      },
      {
        key: 'success-playbook',
        title: 'Success Playbook',
        kind: 'hub',
        summary: 'Core onboarding and renewal material used by the success team.',
        teamspaceKey: 'success',
        children: [
          {
            key: 'onboarding-plan',
            title: 'Onboarding Plan Template',
            kind: 'runbook',
            summary: 'Standard week-by-week onboarding plan for new accounts.',
          },
          {
            key: 'renewal-notes',
            title: 'Renewal Preparation Notes',
            kind: 'notes',
            summary: 'Talking points, objections, and expansion opportunities before renewal.',
          },
        ],
      },
      {
        key: 'delivery-handbook',
        title: 'Delivery Handbook',
        kind: 'hub',
        summary: 'Implementation process, risk register, and project kickoff material.',
        teamspaceKey: 'delivery',
        children: [
          {
            key: 'kickoff-agenda',
            title: 'Project Kickoff Agenda',
            kind: 'notes',
            summary: 'Agenda and outcomes expected during project kickoff.',
          },
          {
            key: 'implementation-spec',
            title: 'Implementation Scope',
            kind: 'spec',
            summary: 'Milestones, interfaces, and non-goals for a delivery project.',
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
