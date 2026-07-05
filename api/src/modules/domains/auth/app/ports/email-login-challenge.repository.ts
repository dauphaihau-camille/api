import type { EmailLoginChallenge } from '../../domain/models/email-login-challenge';

export interface CreateEmailLoginChallengeInput {
  email: string;
  codeHash: string;
  expiresAt: Date;
}

export abstract class EmailLoginChallengeRepository {
  abstract create(
    input: CreateEmailLoginChallengeInput,
  ): Promise<EmailLoginChallenge>;
  abstract findById(id: string): Promise<EmailLoginChallenge | null>;
  abstract save(challenge: EmailLoginChallenge): Promise<void>;
  abstract invalidateActiveChallengesForEmail(email: string): Promise<void>;
}
