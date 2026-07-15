import type { OAuthProvider } from '../auth.types';
import type { OAuthAccount } from '../../domain/models/oauth-account';

export interface CreateOAuthAccountInput {
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
}

export abstract class OAuthAccountRepository {
  abstract findByProviderAccount(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null>;

  abstract create(input: CreateOAuthAccountInput): Promise<OAuthAccount>;
}
