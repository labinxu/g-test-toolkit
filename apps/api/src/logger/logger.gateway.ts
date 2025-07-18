import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'
dotenv.config()

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  },
  namespace: '/log', // 可选，命名空间
})
export class LoggerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
  }

  // 业务方法：向所有客户端发送日志
  sendLog(message: string) {
    this.server.emit('log', message)
  }
  sendLogTo(clientId: string, message: string) {
    this.server.to(clientId).emit('log', message)
  }
  sendExitTo(clientId: string) {
    this.server.to(clientId).emit('ctl', 'exit')
  }

  // 监听客户端发来的自定义消息（可选）
  @SubscribeMessage('hello')
  handleHello(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    console.log('Received from client:', data)
    client.emit('hello', JSON.stringify({ clientId: client.id }))
  }
  @SubscribeMessage('log')
  handleLog(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    console.log('Received from client:', data + client.id)
  }
  @SubscribeMessage('run-script')
  async handleRunScript(@MessageBody() script: string, @ConnectedSocket() client: Socket) {
    const filename = `/tmp/${randomUUID()}.sh`
    try {
      await writeFile(filename, script, { mode: 0o700 })
      // 可将 script 写入临时文件，然后执行 "bash 临时文件"
      const proc = spawn('bash', [filename])
      proc.stdout.on('data', (data) => {
        // 分片逐条发给前端
        client.emit('stdout', data.toString())
      })

      proc.stderr.on('data', (data) => {
        client.emit('stderr', data.toString())
      })

      proc.on('close', (code) => {
        client.emit('close', `process exit,code：${code}`)
        unlink(filename)
      })
    } catch (err) {
    } finally {
    }
  }
}
