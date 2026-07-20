import { Module } from '@nestjs/common';
import { AuthModule } from '../../domains/auth/auth.module';
import { WsAuthService } from './ws-auth.service';
import { WsGateway } from './ws.gateway';
import { WsService } from './ws.service';

@Module({
  imports: [AuthModule],
  providers: [WsAuthService, WsGateway, WsService],
  exports: [WsAuthService, WsService],
})
export class WsModule {}
