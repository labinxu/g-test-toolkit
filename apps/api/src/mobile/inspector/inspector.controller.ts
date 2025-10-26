import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { InspectorService } from './inspector.service';

@Controller('inspector')
export class InspectorController {
  constructor(private readonly inspector: InspectorService) {}

  @Get('snapshot')
  async snapshot(@Query('deviceId') deviceId?: string) {
    try {
      return await this.inspector.snapshot({ deviceId });
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

