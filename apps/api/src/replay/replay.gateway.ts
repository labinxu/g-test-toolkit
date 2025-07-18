import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway(3002, {
  path: '/socket.io',
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  },
  namespace: '/replay', // 可选，命名空间
})
export class ReplayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  handleConnection(client: Socket) {
    console.log(` replay Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`replay Client disconnected: ${client.id}`)
  }
}
