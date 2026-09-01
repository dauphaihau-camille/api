import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { OAuthAccount } from '../../domain/models/oauth-account';
import {
  CreateOAuthAccountInput,
  OAuthAccountRepository,
} from '../../app/ports/oauth-account.repository';
import type { OAuthProvider } from '../../app/auth.types';
import { UserEntity } from '../../../user/infra/persistence/entities/user.entity';
import { OAuthAccountEntity } from './entities/oauth-account.entity';

@Injectable()
export class MikroOrmOAuthAccountRepository implements OAuthAccountRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findByProviderAccount(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    const repository = this.entityManager.fork().getRepository(OAuthAccountEntity);
    const oauthAccount = await repository.findOne(
      {
        provider,
        providerUserId,
      },
      {
        populate: ['user'],
      },
    );

    return oauthAccount ? this.toDomain(oauthAccount) : null;
  }

  async create(input: CreateOAuthAccountInput): Promise<OAuthAccount> {
    const entityManager = this.entityManager.fork();
    const userRepository = entityManager.getRepository(UserEntity);
    const oauthAccountRepository = entityManager.getRepository(OAuthAccountEntity);
    const user = await userRepository.findOneOrFail({ id: input.userId });
    const oauthAccount = oauthAccountRepository.create({
      user,
      provider: input.provider,
      providerUserId: input.providerUserId,
      email: input.email,
    });

    await entityManager.persist(oauthAccount).flush();

    return this.toDomain(oauthAccount);
  }

  private toDomain(oauthAccount: OAuthAccountEntity): OAuthAccount {
    return {
      id: oauthAccount.id,
      userId: oauthAccount.user.id,
      provider: oauthAccount.provider,
      providerUserId: oauthAccount.providerUserId,
      email: oauthAccount.email,
    };
  }
}
