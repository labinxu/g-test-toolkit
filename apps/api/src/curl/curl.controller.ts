import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Controller('curl')
export class CurlController {
  @Post('execute')
  @UseGuards(AuthGuard('jwt'))
  async execute(@Body() body: any) {
    const methodRaw = typeof body?.method === 'string' ? body.method : 'GET'
    const method = methodRaw.toUpperCase()
    const urlRaw = typeof body?.url === 'string' ? body.url.trim() : ''
    const payloadRaw = typeof body?.payload === 'string' ? body.payload : ''
    const headersRaw = typeof body?.headers === 'string' ? body.headers : ''

    if (!urlRaw) {
      throw new BadRequestException('url is required')
    }
    let target: URL
    try {
      target = new URL(urlRaw)
    } catch {
      throw new BadRequestException('Invalid URL')
    }
    if (!/^https?:$/i.test(target.protocol)) {
      throw new BadRequestException('Only http/https URLs are allowed')
    }
    const allowed: Record<string, true> = {
      GET: true,
      POST: true,
      DELETE: true,
    }
    if (!allowed[method]) {
      throw new BadRequestException(`Unsupported method: ${method}`)
    }

    const init: any = { method }
    const headers: Record<string, string> = {}

    // 1) 解析 headers：优先 JSON，对象形式 {"Authorization":"Bearer ..."}
    //    失败则尝试按每行 "Key: Value" 解析，
    //    同时兼容从 curl 命令复制的行：-H 'Key: Value'
    if (headersRaw.trim()) {
      let parsed: any = null
      try {
        parsed = JSON.parse(headersRaw)
      } catch {
        parsed = null
      }
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string') {
            headers[k] = v
          }
        }
      } else {
        const lines = headersRaw.split(/\r?\n/)
        for (const rawLine of lines) {
          let line = rawLine.trim()
          if (!line) continue

          // 兼容 curl: -H 'Key: Value' \  或  --header 'Key: Value'
          if (line.startsWith('-H ')) {
            line = line.slice(3).trim()
          } else if (line.startsWith('--header ')) {
            line = line.slice(9).trim()
          }

          // 去掉行尾的续行反斜杠
          line = line.replace(/\\\s*$/, '').trim()

          // 去掉包裹整行的单/双引号
          if (
            (line.startsWith("'") && line.endsWith("'")) ||
            (line.startsWith('"') && line.endsWith('"'))
          ) {
            line = line.slice(1, -1).trim()
          }

          const idx = line.indexOf(':')
          if (idx <= 0) continue
          let key = line.slice(0, idx).trim()
          let value = line.slice(idx + 1).trim()

          // 单独去掉 key / value 两端的引号
          if (
            (key.startsWith("'") && key.endsWith("'")) ||
            (key.startsWith('"') && key.endsWith('"'))
          ) {
            key = key.slice(1, -1).trim()
          }
          if (
            (value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))
          ) {
            value = value.slice(1, -1).trim()
          }

          if (key && value) {
            headers[key] = value
          }
        }
      }
    }

    // 2) 解析 payload：尽量模拟 curl -d 行为，
    //    兼容直接 JSON 字符串，也兼容从 curl 复制的 "-d '...'" 形式。
    let trimmedPayload = payloadRaw.trim()

    // 去掉 curl 参数前缀
    if (trimmedPayload.startsWith('-d ')) {
      trimmedPayload = trimmedPayload.slice(3).trim()
    } else if (trimmedPayload.startsWith('--data ')) {
      trimmedPayload = trimmedPayload.slice(7).trim()
    } else if (trimmedPayload.startsWith('--data-raw ')) {
      trimmedPayload = trimmedPayload.slice(11).trim()
    }

    // 去掉整段最外层的引号（单/双引号）
    if (
      (trimmedPayload.startsWith("'") && trimmedPayload.endsWith("'")) ||
      (trimmedPayload.startsWith('"') && trimmedPayload.endsWith('"'))
    ) {
      trimmedPayload = trimmedPayload.slice(1, -1).trim()
    }

    if (method !== 'GET' && trimmedPayload) {
      // 不再尝试 JSON.parse，直接按用户输入的文本发送，
      // 只在看起来像 JSON 且未显式设置 Content-Type 时自动补充 application/json。
      init.body = trimmedPayload
      if (
        !headers['content-type'] &&
        (trimmedPayload.startsWith('{') && trimmedPayload.endsWith('}')) ||
        (trimmedPayload.startsWith('[') && trimmedPayload.endsWith(']'))
      ) {
        headers['content-type'] = 'application/json'
      }
    }

    if (Object.keys(headers).length > 0) {
      init.headers = headers
    }

    const res = await fetch(target.toString(), init)
    const ct = res.headers.get('content-type') || ''
    let bodyText: string
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => null)
      bodyText = JSON.stringify(json, null, 2)
    } else {
      bodyText = await res.text().catch(() => '')
    }
    const headersObj: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: headersObj,
      body: bodyText,
    }
  }
}
