import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { WsAuthService } from './ws-auth.service';
import { WsService } from './ws.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WsGateway
implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly wsService: WsService,
  ) {}

  afterInit(server: Server): void {
    this.wsService.attachServer(server);
  }

  async handleConnection(@ConnectedSocket() socket: Socket): Promise<void> {
    try {
      const authenticatedUser = await this.wsAuthService.authenticate(socket);

      socket.data.user = authenticatedUser;
      this.wsService.registerConnection(socket, authenticatedUser);

      this.logger.log(
        `Accepted websocket connection ${socket.id} for user ${authenticatedUser.userId}`,
      );
    }
    catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unauthorized websocket connection';

      socket.emit('error', {
        message,
      });
      socket.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() socket: Socket): void {
    this.wsService.unregisterConnection(socket.id);
  }
}
