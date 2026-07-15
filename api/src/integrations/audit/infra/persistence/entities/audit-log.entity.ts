import {
  Entity, Index, OptionalProps, PrimaryKey, Property, 
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import type { AuditMetadata } from '../../../app/audit.types';

@Entity({ tableName: 'audit_logs' })
@Index({ properties: ['action', 'occurredAt'] })
@Index({ properties: ['resourceType', 'resourceId'] })
@Index({ properties: ['actorId', 'occurredAt'] })
export class AuditLogEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'occurredAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ fieldName: 'created_at' })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ fieldName: 'occurred_at' })
  occurredAt = new Date();

  @Property({ fieldName: 'action' })
  action!: string;

  @Property({ fieldName: 'resource_type' })
  resourceType!: string;

  @Property({ fieldName: 'resource_id', nullable: true })
  resourceId?: string;

  @Property({ fieldName: 'status' })
  status: 'success' | 'failure' = 'success';

  @Property({ fieldName: 'actor_id', nullable: true })
  actorId?: string;

  @Property({ fieldName: 'actor_email', nullable: true })
  actorEmail?: string;

  @Property({ fieldName: 'request_id', nullable: true })
  requestId?: string;

  @Property({ fieldName: 'ip_address', nullable: true })
  ipAddress?: string;

  @Property({ fieldName: 'user_agent', nullable: true })
  userAgent?: string;

  @Property({ fieldName: 'metadata', type: 'json', nullable: true })
  metadata?: AuditMetadata;
}
