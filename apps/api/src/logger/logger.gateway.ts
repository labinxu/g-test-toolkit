import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }, // 允许跨域，生产环境请配置安全域名
  namespace: '/log',     // 可选，命名空间
})
export class LoggerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 业务方法：向所有客户端发送日志
  sendLog(message: string) {
    this.server.emit('log', message);
  }

  // 监听客户端发来的自定义消息（可选）
  @SubscribeMessage('hello')
  handleHello(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    console.log('Received from client:', data);
    client.emit('hello', 'Hello from server');
  }
}
