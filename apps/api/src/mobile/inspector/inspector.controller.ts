import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { InspectorService } from './inspector.service';

@Controller('inspector')
export class InspectorController {
  constructor(private readonly inspector: InspectorService) {}

  @Get('snapshot')
  async snapshot(
    @Query('deviceId') deviceId?: string,
    @Query('autoWake') autoWake?: string,
    @Query('autoUnlock') autoUnlock?: string,
    @Query('unlockPassword') unlockPassword?: string,
    @Query('unlockSwipe') unlockSwipe?: string,
    @Query('unlockKeywords') unlockKeywords?: string,
    @Query('minMs') minMs?: string,
    @Query('preferAppium') preferAppium?: string,
  ) {
    try {
      const aw = autoWake ? /^(1|true|yes|on)$/i.test(autoWake) : true;
      const au = autoUnlock ? /^(1|true|yes|on)$/i.test(autoUnlock) : false;
      return await this.inspector.snapshot({
        deviceId,
        autoWake: aw,
        autoUnlock: au,
        unlockPassword: unlockPassword || undefined,
        unlockSwipe: unlockSwipe || undefined,
        unlockKeywords: unlockKeywords || undefined,
        minIntervalMs: minMs ? Math.max(0, parseInt(minMs, 10) || 0) : undefined,
        preferAppium: preferAppium ? /^(1|true|yes|on)$/i.test(preferAppium) : undefined,
      });
    } catch (e: any) {
      throw new NotFoundException(e?.message ?? 'Snapshot failed');
    }
  }

  @Post('tap')
  async tap(@Body() body: { x: number; y: number; deviceId?: string }) {
    if (typeof body?.x !== 'number' || typeof body?.y !== 'number') {
      throw new NotFoundException('x/y required');
    }
    try {
      return await this.inspector.tapCoordinate({ x: body.x, y: body.y, deviceId: body.deviceId });
    } catch (e: any) {
      throw new NotFoundException(e?.message ?? 'Tap failed');
    }
  }

  @Post('find-and-tap')
  async findAndTap(
    @Body()
    body: { using: string; value: string; deviceId?: string },
  ) {
    const { using, value, deviceId } = body ?? ({} as any);
    if (!using || !value) throw new NotFoundException('using/value required');
    try {
      return await this.inspector.findAndTap({ using, value, deviceId });
    } catch (e: any) {
      throw new NotFoundException(e?.message ?? 'Find and tap failed');
    }
  }
}
