export interface EmailLoginChallenge {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt?: Date;
}
