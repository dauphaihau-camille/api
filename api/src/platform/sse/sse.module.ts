import { Module } from '@nestjs/common';
import { AuthModule } from '../../domains/auth/auth.module';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

@Module({
  imports: [AuthModule],
  controllers: [SseController],
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
