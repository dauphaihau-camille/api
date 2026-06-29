import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuditRecordInput } from './app/audit.types';
import { RequestContextService } from '../request-context/request-context.service';
import { AuditLogEntity } from './infra/persistence/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly requestContextService: RequestContextService,
  ) {}

  async record(input: AuditRecordInput): Promise<AuditLogEntity> {
    const entityManager = this.entityManager.fork();
    const requestContext = this.requestContextService.get();

    const auditLog = entityManager.create(AuditLogEntity, {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: input.status ?? 'success',
      metadata: input.metadata,
      occurredAt: input.occurredAt ?? new Date(),
      actorId: input.actor?.actorId ?? requestContext.actorId,
      actorEmail: input.actor?.actorEmail ?? requestContext.actorEmail,
      requestId: requestContext.requestId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    });

    await entityManager.persistAndFlush(auditLog);

    return auditLog;
  }
}
