import {
  Controller,
  Get,
  Post,
  NotFoundException,
  Param,
  StreamableFile,
  Res,
  Body,
} from '@nestjs/common';
import { AndroidService } from './android.service';
import { createReadStream } from 'fs';
import { FastifyReply as Response } from 'fastify';
import { ScreenOnDto } from './dto/screenon.dto';
@Controller('android')
export class AndroidController {
  constructor(private readonly androidService: AndroidService) {}

  @Get('/devices')
  async getDevices() {
    return await this.androidService.getDevices();
  }
  @Get('/screen/:deviceId')
  async getScreen(
    @Param('deviceId') deviceId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const filePath = await this.androidService.streamScreen(deviceId, res);
      res.header('content-type', 'image/png');
      return new StreamableFile(createReadStream(filePath));
    } catch (err) {
      throw new NotFoundException(
        `Failed to retrieve screenshot from device: ${deviceId}`,
      );
    }
  }
  @Get('/dump/:deviceId')
  async getDumpxml(@Param('deviceId') deviceId: string, @Res() res: Response) {
    try {
      await this.androidService.dumpxml(deviceId, res);
    } catch (err) {
      throw new NotFoundException('Failed to retrieve dump file');
    }
  }
  @Post('/screenon')
  async screenOn(@Body() screenOndto: ScreenOnDto) {
    await this.androidService.screenOn(
      screenOndto.deviceId,
      screenOndto.checkKeywords,
      screenOndto.password,
      screenOndto.swipeCord,
    );
  }
}
