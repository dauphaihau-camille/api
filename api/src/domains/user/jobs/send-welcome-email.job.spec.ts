import type { MailSender } from '~/integrations/mail/app/ports/mail-sender';
import { SendWelcomeEmailJob } from './send-welcome-email.job';

describe('SendWelcomeEmailJob', () => {
  it('sends the welcome email', async () => {
    const mailSender = {
      send: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<MailSender, 'send'>;
    const job = new SendWelcomeEmailJob(mailSender as unknown as MailSender);

    await job.run({
      userId: 'user-1',
      email: 'user@example.com',
      displayName: 'Example User',
    });

    expect(mailSender.send).toHaveBeenCalledWith({
      to: { email: 'user@example.com', name: 'Example User' },
      subject: 'Welcome',
      text: 'Hello Example User, your account was created.',
      html: '<p>Hello Example User, your account was created.</p>',
      tags: ['user-created'],
    });
  });
});
