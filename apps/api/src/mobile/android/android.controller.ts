import {
  Controller,
  Get,
  Post,
  NotFoundException,
  Param,
  StreamableFile,
  Res,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AndroidService } from './android.service'
import { createReadStream } from 'fs'
import { FastifyReply as Response } from 'fastify'
import { ScreenOnDto } from './dto/screenon.dto'
import { StartEmulatorDto, StopEmulatorDto } from './dto/emulator-control.dto'
@Controller('android')
export class AndroidController {
  constructor(private readonly androidService: AndroidService) {}

  @Get('/devices')
  @UseGuards(AuthGuard('jwt'))
  async getDevices() {
    return await this.androidService.getDevices()
  }
  @Get('/screen/:deviceId')
  async getScreen(@Param('deviceId') deviceId: string, @Res({ passthrough: true }) res: Response) {
    try {
      const filePath = await this.androidService.streamScreen(deviceId)
      res.header('content-type', 'image/png')
      return new StreamableFile(createReadStream(filePath))
    } catch (err) {
      throw new NotFoundException(`Failed to retrieve screenshot from device: ${deviceId}`)
    }
  }
  @Get('/dump/:deviceId')
  async getDumpxml(@Param('deviceId') deviceId: string, @Res() res: Response) {
    try {
      await this.androidService.dumpxml(deviceId, res)
    } catch (err) {
      throw new NotFoundException('Failed to retrieve dump file')
    }
  }
  @Post('/screenon')
  async screenOn(@Body() screenOndto: ScreenOnDto) {
    await this.androidService.screenOn(
      screenOndto.deviceId,
      screenOndto.checkKeywords,
      screenOndto.password,
      screenOndto.swipeCord
    )
  }

  @Get('/emulators')
  @UseGuards(AuthGuard('jwt'))
  async getEmulators() {
    try {
      const avds = await this.androidService.listEmulators()
      const running = await this.androidService.getRunningEmulator()
      return { avds, running }
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) || 'Failed to list Android emulators'
      )
    }
  }

  @Post('/emulators/start')
  @UseGuards(AuthGuard('jwt'))
  async startEmulator(@Body() body: StartEmulatorDto) {
    try {
      const result = await this.androidService.startStandaloneEmulator(body.avd, body.headless)
      return {
        result: 'ok',
        started: true,
        ...result,
        message: result.deviceName
          ? `Emulator ${result.deviceName} started`
          : result.avd
            ? `Emulator ${result.avd} started`
            : `Emulator ${result.serial ?? ''} started`.trim(),
      }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to start emulator')
    }
  }

  @Post('/emulators/stop')
  async stopEmulator(@Body() body: StopEmulatorDto) {
    try {
      const result = await this.androidService.stopEmulator(body.serial)
      return {
        result: 'ok',
        ...result,
        message: result.stopped
          ? `Stopped emulator ${result.deviceName ?? result.serial ?? ''}`.trim()
          : 'No running emulator detected',
      }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to stop emulator')
    }
  }

  @Get('/init')
  @UseGuards(AuthGuard('jwt'))
  async initAndroid(
    @Query('avd') avd?: string,
    @Query('headless') headless?: string,
    @Query('port') port?: string
  ) {
    try {
      const headlessFlag = headless ? /^(1|true|yes|on)$/i.test(headless) : false
      const portNum = port ? parseInt(port, 10) : 4723

      await this.androidService.initAndroidEnvironment({
        avd,
        headless: headlessFlag,
        port: portNum,
      })

      return {
        result: 'ok',
        message: 'initializing Android environment...',
        avd: avd || null,
        headless: headlessFlag,
        port: portNum,
      }
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) || 'Failed to initialize Android environment'
      )
    }
  }
}
