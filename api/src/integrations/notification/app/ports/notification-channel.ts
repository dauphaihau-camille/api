import type {
  NotificationChannelName,
  NotificationInput,
} from '../notification.types';

export abstract class NotificationChannel {
  abstract readonly channel: NotificationChannelName;
  abstract send(input: NotificationInput): Promise<void>;
}
