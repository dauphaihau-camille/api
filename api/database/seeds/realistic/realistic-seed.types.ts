import type { EntityManager } from '@mikro-orm/postgresql';
import type { DocumentAccessGrantPermission } from '../../../src/domains/document/domain/enums/document-access-grant-permission.enum';
import type { SubscriptionPlan } from '../../../src/domains/subscription/domain/enums/subscription-plan.enum';
import type { SubscriptionStatus } from '../../../src/domains/subscription/domain/enums/subscription-status.enum';
import type { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';

export type RealisticSeedConfig = {
  workspaceReplicas: number;
  extraMembersPerWorkspace: number;
  password: string;
};

export type SeedUserSummary = {
  id: string;
  email: string;
  displayName: string;
};

export type SeedDocumentSummary = {
  key: string;
  id: string;
  publicId: string;
  title: string;
  workspaceId: string;
  parentId?: string;
  teamspaceId?: string;
};

export type WorkspaceMemberSeed = {
  user: SeedUserSummary;
  role: WorkspaceRole;
};

export type WorkspaceSubscriptionSeed = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  providerStatus?: string;
};

export type UpsertDocumentAccessGrantInput = {
  em: EntityManager;
  workspaceId: string;
  documentId: string;
  userId: string;
  permission: DocumentAccessGrantPermission;
  grantedById: string;
};
