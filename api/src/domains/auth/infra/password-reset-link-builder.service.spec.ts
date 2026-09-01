import { AuthPasswordResetLinkBuilder } from './password-reset-link-builder.service';

describe('AuthPasswordResetLinkBuilder', () => {
  it('preserves safe Post-Login Redirect targets in Password Reset links', () => {
    const builder = new AuthPasswordResetLinkBuilder({
      appBaseUrl: 'http://localhost:5102',
    } as never);

    expect(builder.build('raw token', '/w/acme')).toBe(
      'http://localhost:5102/reset?t=raw+token&redirectTo=%2Fw%2Facme',
    );
  });

  it('drops unsafe redirect targets from Password Reset links', () => {
    const builder = new AuthPasswordResetLinkBuilder({
      appBaseUrl: 'http://localhost:5102',
    } as never);

    expect(builder.build('raw-token', '//evil.test')).toBe(
      'http://localhost:5102/reset?t=raw-token',
    );
  });
});
