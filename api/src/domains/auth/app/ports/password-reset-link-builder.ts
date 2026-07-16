export abstract class PasswordResetLinkBuilder {
  abstract build(token: string): string;
}
