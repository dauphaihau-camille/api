import type { EntityManager } from '@mikro-orm/postgresql';
import type { StorageService } from '~/integrations/storage/app/ports/storage.service';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { MikroOrmAuthUserRepository } from './mikro-orm-auth-user.repository';
import type { CurrentUserCredentialEntity } from './entities/current-user-credential.entity';
import { CurrentUserEntity } from './entities/current-user.entity';

describe('MikroOrmAuthUserRepository', () => {
  it('creates the first Password Credential when updating a Passwordless Account password', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const persist = jest.fn().mockReturnValue({ flush });
    const user = { id: 'user-1' } as CurrentUserEntity;
    const createdCredential = {
      user,
      passwordHash: 'hashed-password',
      passwordUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as CurrentUserCredentialEntity;
    const userRepository = {
      findOneOrFail: jest.fn().mockResolvedValue(user),
    };
    const credentialRepository = {
      create: jest.fn().mockReturnValue(createdCredential),
    };
    const entityManager = {
      fork: jest.fn().mockReturnThis(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === CurrentUserEntity) {
          return userRepository;
        }

        return credentialRepository;
      }),
      persist,
    } as unknown as EntityManager;
    const repository = new MikroOrmAuthUserRepository(
      entityManager,
      {} as StorageService,
    );
    const passwordUpdatedAt = new Date('2026-02-01T00:00:00.000Z');

    await repository.updatePassword({
      userId: 'user-1',
      passwordHash: PasswordHash.fromPersisted('$2b$new-hashed-password'),
      passwordUpdatedAt,
    });

    expect(userRepository.findOneOrFail).toHaveBeenCalledWith(
      { id: 'user-1' },
      { populate: ['credential'] },
    );
    expect(credentialRepository.create).toHaveBeenCalledWith({
      user,
      passwordHash: '$2b$new-hashed-password',
      passwordUpdatedAt,
    });
    expect(user.credential).toBe(createdCredential);
    expect(createdCredential.passwordHash).toBe('$2b$new-hashed-password');
    expect(createdCredential.passwordUpdatedAt).toBe(passwordUpdatedAt);
    expect(persist).toHaveBeenCalledWith([user, createdCredential]);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
