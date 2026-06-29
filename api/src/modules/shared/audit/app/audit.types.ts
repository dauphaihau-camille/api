export interface AuditMetadata {
  [key: string]: unknown;
}

export interface AuditActor {
  actorId?: string;
  actorEmail?: string;
}

export interface AuditRecordInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  status?: 'success' | 'failure';
  metadata?: AuditMetadata;
  occurredAt?: Date;
  actor?: AuditActor;
}
