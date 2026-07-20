import { Logger } from '@nestjs/common';
import { ResendMailSender } from './resend-mail.sender';

jest.mock('~/platform/http/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

import { fetchWithTimeout } from '~/platform/http/fetch-with-timeout';

describe('ResendMailSender', () => {
  const fetchWithTimeoutMock = jest.mocked(fetchWithTimeout);
  const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    fetchWithTimeoutMock.mockReset();
    loggerWarnSpy.mockClear();
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    loggerWarnSpy.mockRestore();
  });

  it('logs and skips Resend for reserved test recipients outside production', async () => {
    const sender = new ResendMailSender({
      driver: 'resend',
      resendApiKey: 'test-key',
      defaultFrom: {
        email: 'no-reply@example.test',
        name: 'Camille',
      },
    });

    await sender.send({
      to: { email: 'member@example.com' },
      subject: 'Your Camille sign-in code',
      text: '123456',
    });

    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping Resend delivery for reserved test recipient domain in non-production runtime'),
    );
  });

  it('still calls Resend for reserved test recipients in production', async () => {
    process.env.NODE_ENV = 'production';
    fetchWithTimeoutMock.mockResolvedValue({
      ok: true,
    } as Response);

    const sender = new ResendMailSender({
      driver: 'resend',
      resendApiKey: 'test-key',
      defaultFrom: {
        email: 'no-reply@hautran.me',
        name: 'Camille',
      },
    });

    await sender.send({
      to: { email: 'member@example.com' },
      subject: 'Your Camille sign-in code',
      text: '123456',
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });
});
