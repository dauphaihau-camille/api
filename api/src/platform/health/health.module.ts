import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { StorageModule } from '~/integrations/storage/storage.module';

@Module({
  imports: [MikroOrmModule, StorageModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
