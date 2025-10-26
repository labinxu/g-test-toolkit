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
  Delete,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AndroidService } from './android.service'
import { createReadStream } from 'fs'
import { FastifyReply as Response } from 'fastify'
import { ScreenOnDto } from './dto/screenon.dto'
import {
  StartEmulatorDto,
  StopEmulatorDto,
  CreateEmulatorDto,
} from './dto/emulator-control.dto'
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
      const result = await this.androidService.startStandaloneEmulator({
        avd: body.avd,
        headless: body.headless,
        reset: body.reset,
        randomizeDeviceId: body.randomizeDeviceId,
      })
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

  // Appium server controls
  @Get('/appium/status')
  @UseGuards(AuthGuard('jwt'))
  async appiumStatus() {
    try {
      return this.androidService.getAppiumStatus()
    } catch (err) {
      throw new NotFoundException('Failed to get Appium status')
    }
  }

  @Post('/appium/start')
  @UseGuards(AuthGuard('jwt'))
  async appiumStart(@Body() body: { port?: number }) {
    try {
      const { started, port } = await this.androidService.startAppiumServerOnly(body?.port ?? 4723)
      return { result: 'ok', started, port, message: `Appium server ${started ? 'started' : 'already running'} on port ${port}` }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to start Appium server')
    }
  }

  @Post('/appium/stop')
  @UseGuards(AuthGuard('jwt'))
  async appiumStop() {
    try {
      const { stopped } = await this.androidService.stopAppiumServerOnly()
      return { result: 'ok', stopped, message: stopped ? 'Appium server stopped' : 'Appium server was not running' }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to stop Appium server')
    }
  }

  @Get('/emulators/creatable')
  @UseGuards(AuthGuard('jwt'))
  async getCreatableEmulators() {
    try {
      const templates = await this.androidService.listCreatableEmulators()
      return { templates }
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) || 'Failed to fetch emulator templates'
      )
    }
  }

  @Post('/emulators/create')
  @UseGuards(AuthGuard('jwt'))
  async createEmulator(@Body() body: CreateEmulatorDto) {
    try {
      const result = await this.androidService.createEmulatorFromTemplate(body.templateId, body.name)
      return {
        result: 'ok',
        ...result,
        message: `Created emulator ${result.avd}`,
      }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to create emulator')
    }
  }

  @Delete('/emulators/:avd')
  @UseGuards(AuthGuard('jwt'))
  async deleteEmulator(@Param('avd') avd: string) {
    try {
      const result = await this.androidService.deleteEmulator(avd)
      return {
        result: 'ok',
        ...result,
        message: result.deleted
          ? `Deleted emulator ${result.avd}`
          : `Emulator ${avd} not deleted`,
      }
    } catch (err) {
      throw new NotFoundException((err && (err as Error).message) || 'Failed to delete emulator')
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
