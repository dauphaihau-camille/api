import type { EntityManager } from '@mikro-orm/postgresql';
import { SubscriptionPlan } from '../../../src/domains/subscription/domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../src/domains/subscription/domain/enums/subscription-status.enum';
import { WorkspaceSubscriptionEntity } from '../../../src/domains/subscription/infra/persistence/entities/workspace-subscription.entity';
import { UserEntity } from '../../../src/domains/user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace-member.entity';
import type {
  WorkspaceSubscriptionSeedState,
  WorkspaceSubscriptionTemplate,
} from '../fixtures/realistic.types';
import type { WorkspaceMemberSeed, WorkspaceSubscriptionSeed } from './realistic-seed.types';
import { buildSeededProviderId } from './shared.seed';

const PROVIDER_STATUS_BY_SUBSCRIPTION_STATE: Record<Exclude<WorkspaceSubscriptionSeedState, 'free'>, string> = {
  plus_active: 'active',
  plus_canceling: 'active',
  plus_past_due: 'past_due',
};

const SUBSCRIPTION_STATUS_BY_STATE: Record<Exclude<WorkspaceSubscriptionSeedState, 'free'>, SubscriptionStatus> = {
  plus_active: SubscriptionStatus.ACTIVE,
  plus_canceling: SubscriptionStatus.CANCELING,
  plus_past_due: SubscriptionStatus.PAST_DUE,
};

export function buildRealisticSubscriptionSeed(input: {
  workspaceKey: string;
  workspaceName: string;
  replicaIndex: number;
  template?: WorkspaceSubscriptionTemplate;
}): WorkspaceSubscriptionSeed {
  const state = input.template?.replicaStates?.[input.replicaIndex] ??
    input.template?.state ??
    'free';

  if (state === 'free') {
    return {
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.FREE,
      cancelAtPeriodEnd: false,
    };
  }

  const providerSeed = `${input.workspaceKey}:${input.replicaIndex}`;

  return {
    plan: SubscriptionPlan.PLUS,
    status: SUBSCRIPTION_STATUS_BY_STATE[state],
    cancelAtPeriodEnd: state === 'plus_canceling',
    provider: 'stripe',
    providerCustomerId: buildSeededProviderId('cus_demo', providerSeed),
    providerSubscriptionId: buildSeededProviderId('sub_demo', providerSeed),
    providerPriceId: 'price_demo_plus_monthly',
    providerStatus: PROVIDER_STATUS_BY_SUBSCRIPTION_STATE[state],
  };
}

export async function upsertWorkspace(
  em: EntityManager,
  slug: string,
  name: string,
  description: string,
): Promise<WorkspaceEntity> {
  const existingWorkspace = await em.findOne(WorkspaceEntity, { slug });
  const workspace = existingWorkspace ??
    em.create(WorkspaceEntity, { slug, name, description });

  workspace.name = name;
  workspace.description = description;
  em.persist(workspace);
  await em.flush();

  return workspace;
}

export async function upsertWorkspaceMembers(
  em: EntityManager,
  workspaceId: string,
  members: WorkspaceMemberSeed[],
): Promise<void> {
  const existingMemberships = await em.find(WorkspaceMemberEntity, {
    workspace: workspaceId,
    user: { $in: members.map((member) => member.user.id) },
  }, {
    populate: ['user'],
  });
  const existingByUserId = new Map(existingMemberships.map((membership) => [membership.user.id, membership]));

  for (const member of members) {
    const membership = existingByUserId.get(member.user.id) ??
      em.create(WorkspaceMemberEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(UserEntity, member.user.id),
        role: member.role,
        joinedAt: new Date(),
      });

    membership.role = member.role;
    em.persist(membership);
  }

  await em.flush();
}

export async function upsertWorkspaceSubscription(input: {
  em: EntityManager;
  workspaceId: string;
  seatCount: number;
  seed: WorkspaceSubscriptionSeed;
}): Promise<void> {
  const existingSubscription = await input.em.findOne(WorkspaceSubscriptionEntity, {
    workspace: input.workspaceId,
  });
  const subscription = existingSubscription ??
    input.em.create(WorkspaceSubscriptionEntity, {
      workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
      plan: input.seed.plan,
      status: input.seed.status,
      seatCount: input.seatCount,
      cancelAtPeriodEnd: input.seed.cancelAtPeriodEnd,
    });
  const isPaid = input.seed.plan === SubscriptionPlan.PLUS;

  subscription.workspace = input.em.getReference(WorkspaceEntity, input.workspaceId);
  subscription.plan = input.seed.plan;
  subscription.status = input.seed.status;
  subscription.seatCount = input.seatCount;
  subscription.cancelAtPeriodEnd = input.seed.cancelAtPeriodEnd;
  subscription.currentPeriodStart = isPaid
    ? new Date(Date.UTC(2026, 7, 1, 0, 0, 0))
    : undefined;
  subscription.currentPeriodEnd = isPaid
    ? new Date(Date.UTC(2026, 8, 1, 0, 0, 0))
    : undefined;
  subscription.provider = input.seed.provider;
  subscription.providerCustomerId = input.seed.providerCustomerId;
  subscription.providerSubscriptionId = input.seed.providerSubscriptionId;
  subscription.providerPriceId = input.seed.providerPriceId;
  subscription.providerStatus = input.seed.providerStatus;
  input.em.persist(subscription);
  await input.em.flush();
}
