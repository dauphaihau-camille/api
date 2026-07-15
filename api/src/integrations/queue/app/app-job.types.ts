export const appJobName = {
  sendWelcomeEmail: 'user.send-welcome-email',
  notificationSendEmail: 'notification.send-email',
  permanentlyDeleteArchivedDocument: 'document.permanently-delete-archived',
} as const;

export interface AppJobPayloadMap {
  [appJobName.sendWelcomeEmail]: {
    userId: string;
    email: string;
    displayName?: string;
  };
  [appJobName.notificationSendEmail]: {
    to: Array<{
      email: string;
      name?: string;
    }>;
    subject: string;
    text?: string;
    html?: string;
    from?: {
      email: string;
      name?: string;
    };
    replyTo?:
      | {
        email: string;
        name?: string;
      }
      | Array<{
        email: string;
        name?: string;
      }>;
    cc?: Array<{
      email: string;
      name?: string;
    }>;
    bcc?: Array<{
      email: string;
      name?: string;
    }>;
    tags?: string[];
  };
  [appJobName.permanentlyDeleteArchivedDocument]: {
    documentId: string;
    archivedAt: string;
  };
}

export type AppJobName = keyof AppJobPayloadMap;

export interface DispatchJobOptions {
  deduplicationKey?: string;
  delayMs?: number;
}

export interface AppJobHandler<
  TName extends AppJobName = AppJobName,
> {
  readonly jobName: TName;
  run(payload: AppJobPayloadMap[TName]): Promise<void>;
}
