import type { AuthenticatedUser } from '../../../domains/auth/app/auth.types';

export interface WsConnectionSnapshot {
  socketId: string;
  user: AuthenticatedUser;
}
