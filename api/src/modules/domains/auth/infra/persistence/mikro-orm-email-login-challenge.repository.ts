import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
  CreateEmailLoginChallengeInput,
  EmailLoginChallengeRepository,
} from '../../app/ports/email-login-challenge.repository';
import type { EmailLoginChallenge } from '../../domain/models/email-login-challenge';
import { EmailLoginChallengeEntity } from './entities/email-login-challenge.entity';

@Injectable()
export class MikroOrmEmailLoginChallengeRepository
implements EmailLoginChallengeRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async create(
    input: CreateEmailLoginChallengeInput,
  ): Promise<EmailLoginChallenge> {
    const entityManager = this.entityManager.fork();
    const repository = entityManager.getRepository(EmailLoginChallengeEntity);
    const challenge = repository.create({
      email: input.email,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
    });

    await entityManager.persist(challenge).flush();

    return this.toDomain(challenge);
  }

  async findById(id: string): Promise<EmailLoginChallenge | null> {
    const repository = this.entityManager
      .fork()
      .getRepository(EmailLoginChallengeEntity);
    const challenge = await repository.findOne({ id });

    return challenge ? this.toDomain(challenge) : null;
  }

  async save(challenge: EmailLoginChallenge): Promise<void> {
    const entityManager = this.entityManager.fork();
    const repository = entityManager.getRepository(EmailLoginChallengeEntity);
    const existingChallenge = await repository.findOneOrFail({ id: challenge.id });

    existingChallenge.expiresAt = challenge.expiresAt;
    existingChallenge.consumedAt = challenge.consumedAt;

    await entityManager.flush();
  }

  async invalidateActiveChallengesForEmail(email: string): Promise<void> {
    const entityManager = this.entityManager.fork();
    const repository = entityManager.getRepository(EmailLoginChallengeEntity);
    const activeChallenges = await repository.find({
      email,
      consumedAt: null,
    });

    if (activeChallenges.length === 0) {
      return;
    }

    const consumedAt = new Date();

    for (const challenge of activeChallenges) {
      challenge.consumedAt = consumedAt;
    }

    await entityManager.flush();
  }

  private toDomain(
    challenge: EmailLoginChallengeEntity,
  ): EmailLoginChallenge {
    return {
      id: challenge.id,
      email: challenge.email,
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      consumedAt: challenge.consumedAt,
    };
  }
}
