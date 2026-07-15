import type { JobDispatcher } from '~/integrations/queue/app/ports/job-dispatcher';
import { appJobName } from '~/integrations/queue/app/app-job.types';
import { UserCreatedEvent } from '../events/user-created.event';
import { SendWelcomeEmailOnUserCreatedListener } from './send-welcome-email-on-user-created.listener';

describe('SendWelcomeEmailOnUserCreatedListener', () => {
  it('enqueues the welcome email job', async () => {
    const jobDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<JobDispatcher, 'dispatch'>;
    const listener = new SendWelcomeEmailOnUserCreatedListener(
      jobDispatcher as unknown as JobDispatcher,
    );

    await listener.handle(
      new UserCreatedEvent('user-1', 'user@example.com', 'Example User'),
    );

    expect(jobDispatcher.dispatch).toHaveBeenCalledWith(
      appJobName.sendWelcomeEmail,
      {
        userId: 'user-1',
        email: 'user@example.com',
        displayName: 'Example User',
      },
      {
        deduplicationKey: `${appJobName.sendWelcomeEmail}:user-1`,
      },
    );
  });
});
