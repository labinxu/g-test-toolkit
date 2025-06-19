import { Controller, Get, Post, NotFoundException, Param, Res, Body } from '@nestjs/common'
import { AndroidService } from './android.service'
import { Response } from 'express'
import { ScreenOnDto } from './dto/screenon.dto'
@Controller()
export class AndroidController {
  constructor(private readonly androidService: AndroidService) { }

  @Get('/mobile/android/devices')
  async getDevices(): Promise<string> {
    return await this.androidService.getDevices()
  }
  @Get('/mobile/android/screen/:deviceId')
  async getScreen(@Param('deviceId') deviceId: string, @Res({ passthrough: true }) res: Response) {
    try {
      await this.androidService.streamScreen(deviceId, res)
    } catch (err) {
      throw new NotFoundException(`Failed to retrieve screenshot from device: ${deviceId}`)
    }
  }
  @Get('/mobile/android/dump/:deviceId')
  async getDumpxml(@Param('deviceId') deviceId: string, @Res() res: Response) {
    try {
      await this.androidService.dumpxml(deviceId, res)
    } catch (err) {
      throw new NotFoundException('Failed to retrieve dump file')
    }
  }
  @Post('/mobile/android/screenon')
  async screenOn(@Body() screenOndto: ScreenOnDto) {
    await this.androidService.screenOn(
      screenOndto.deviceId,
      screenOndto.checkKeywords,
      screenOndto.password,
      screenOndto.swipeCord
    )
  }
}
