import { Controller, All, Query, Req, Res } from '@nestjs/common'
import { ProxyService } from './proxy.service'
import { FastifyRequest, FastifyReply } from 'fastify'
import { IncomingMessage, ServerResponse } from 'http'

@Controller('proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) { }

  @All()
  proxy(
    @Query('url') targetUrl: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply
  ): void {
    if (!targetUrl) {
      console.log('Missing URL parameter')
      reply.status(400).send({ error: 'URL parameter is required' })
      return
    }

    try {
      const url = new URL(targetUrl)
      const proxysrv = this.proxyService.createProxy(url.origin)

      // 调用代理中间件
      proxysrv(
        request.raw as IncomingMessage,
        reply.raw as ServerResponse<IncomingMessage>,
        (err) => {
          if (err) {
            console.error('Proxy middleware error:', err)
            if (!reply.sent) {
              reply.status(500).send({ error: `Proxy error: ${err.message}` })
            }
            return
          }
          console.log('Proxy response completed for:', targetUrl)
          if (!reply.sent) {
            console.log('Finalizing response for:', targetUrl)
            reply.raw.end()
          }
        }
      )
    } catch (error) {
      console.error('Proxy failed:', error)
      if (!reply.sent) {
        reply.status(400).send({ error: `Invalid URL: ${error}` })
      }
    }
  }
}
