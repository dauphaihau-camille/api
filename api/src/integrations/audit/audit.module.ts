import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { RequestContextModule } from '../../platform/request-context/request-context.module';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './infra/persistence/entities/audit-log.entity';

@Module({
  imports: [MikroOrmModule.forFeature([AuditLogEntity]), RequestContextModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
