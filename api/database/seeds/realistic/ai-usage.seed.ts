import type { EntityManager } from '@mikro-orm/postgresql';
import { AiResponseReservationEntity } from '../../../src/domains/ai-assistance/infra/persistence/entities/ai-response-reservation.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';

const BASE_TRIAL_RESPONSES = 10;
const TRIAL_RESPONSES_PER_SEAT = 5;

export function resolveAiTrialResponseAllowance(seatCount: number): number {
  return BASE_TRIAL_RESPONSES + (TRIAL_RESPONSES_PER_SEAT * seatCount);
}

export async function seedConsumedAiResponses(input: {
  em: EntityManager;
  workspaceId: string;
  workspaceName: string;
  consumedResponses: number;
}): Promise<void> {
  const existingReservations = await input.em.find(AiResponseReservationEntity, {
    workspace: input.workspaceId,
  });

  if (existingReservations.length > 0) {
    input.em.remove(existingReservations);
    await input.em.flush();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (10 * 60 * 1000));

  for (let index = 0; index < input.consumedResponses; index += 1) {
    const createdAt = new Date(now.getTime() - ((input.consumedResponses - index) * 60_000));
    const reservation = input.em.create(AiResponseReservationEntity, {
      workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
      status: 'consumed',
      expiresAt,
    });
    reservation.createdAt = createdAt;
    reservation.updatedAt = createdAt;
    input.em.persist(reservation);
  }

  await input.em.flush();

  console.log(
    `[seed][realistic][ai-usage] Set ${input.workspaceName} to ${input.consumedResponses} consumed AI responses`,
  );
}

export async function seedExhaustedAiTrialUsage(input: {
  em: EntityManager;
  workspaceId: string;
  workspaceName: string;
  seatCount: number;
}): Promise<void> {
  const allowance = resolveAiTrialResponseAllowance(input.seatCount);

  await seedConsumedAiResponses({
    em: input.em,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    consumedResponses: allowance,
  });

  console.log(
    `[seed][realistic][ai-usage] Exhausted AI trial usage for ${input.workspaceName}: ${allowance}/${allowance} consumed responses`,
  );
}
