import type { OAuthProvider } from '../../app/auth.types';

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
}
