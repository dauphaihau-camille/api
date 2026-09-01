export abstract class PasswordResetLinkBuilder {
  abstract build(token: string, redirectTo?: string): string;
}
