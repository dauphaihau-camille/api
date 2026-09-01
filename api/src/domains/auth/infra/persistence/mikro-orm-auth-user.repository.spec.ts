import type { EntityManager } from '@mikro-orm/postgresql';
import type { StorageService } from '~/integrations/storage/app/ports/storage.service';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { MikroOrmAuthUserRepository } from './mikro-orm-auth-user.repository';
import type { UserCredentialEntity } from './entities/user-credential.entity';
import { UserEntity } from '../../../user/infra/persistence/entities/user.entity';

describe('MikroOrmAuthUserRepository', () => {
  it('creates the first Password Credential when updating a Passwordless Account password', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const persist = jest.fn().mockReturnValue({ flush });
    const user = { id: 'user-1' } as UserEntity;
    const createdCredential = {
      user,
      passwordHash: 'hashed-password',
      passwordUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as UserCredentialEntity;
    const userRepository = {
      findOneOrFail: jest.fn().mockResolvedValue(user),
    };
    const credentialRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(createdCredential),
    };
    const entityManager = {
      fork: jest.fn().mockReturnThis(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === UserEntity) {
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

    expect(userRepository.findOneOrFail).toHaveBeenCalledWith({ id: 'user-1' });
    expect(credentialRepository.findOne).toHaveBeenCalledWith({ user });
    expect(credentialRepository.create).toHaveBeenCalledWith({
      user,
      passwordHash: '$2b$new-hashed-password',
      passwordUpdatedAt,
    });
    expect(createdCredential.passwordHash).toBe('$2b$new-hashed-password');
    expect(createdCredential.passwordUpdatedAt).toBe(passwordUpdatedAt);
    expect(persist).toHaveBeenCalledWith(createdCredential);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
