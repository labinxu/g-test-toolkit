import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SettingsService } from 'src/settings/settings.service'

@Controller('traceability')
export class ExportConfigController {
  constructor(private readonly settings: SettingsService) {}

  private key(userId: number) {
    return `user:${userId}:traceability.export`
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('export-config')
  async getConfig(@Req() req: any) {
    const user = req?.user
    const raw = await this.settings.get(this.key(Number(user?.id)))
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('export-config')
  async setConfig(@Req() req: any, @Body() body: any) {
    const user = req?.user
    const key = this.key(Number(user?.id))
    await this.settings.set(key, JSON.stringify(body || {}))
    return { ok: true }
  }
}

