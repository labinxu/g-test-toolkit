import {
  Controller,
  Get,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IosService } from './ios.service';
import { getErrorMessage } from 'src/common/utils';
import { randomUUID } from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { StartSimulatorDto, StopSimulatorDto } from './dto/simulator-control.dto';
import { Body, Post } from '@nestjs/common';

@ApiTags('ios')
@Controller('ios')
export class IosController {
  constructor(private readonly iosService: IosService) {}

  @ApiOperation({
    summary: 'Initialize iOS test environment',
    description:
      'Boot iOS Simulator, install Appium dependencies, and start Appium server.',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description:
      'Client ID for log streaming. Defaults to a random UUID when omitted.',
    example: 'auto-generated',
  })
  @ApiQuery({
    name: 'device',
    required: false,
    description: 'Simulator device name',
    example: 'iPhone 16',
  })
  @ApiQuery({
    name: 'runtime',
    required: false,
    description: 'iOS runtime version or key',
    example: '18.6',
  })
  @ApiQuery({
    name: 'udid',
    required: false,
    description:
      'Simulator UDID (overrides device/runtime when provided). Use GET /ios/devices to list available UDIDs.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @ApiQuery({
    name: 'port',
    required: false,
    description: 'Appium server port',
    schema: { type: 'integer', default: 4723 },
  })
  @ApiOkResponse({
    description: 'Initialization started',
    schema: {
      example: {
        result: 'ok',
        message: 'initializing iOS environment...',
        clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        port: 4723,
      },
    },
  })
  @Get('init')
  async initIos(
    @Query('clientId') clientId?: string,
    @Query('device') device?: string,
    @Query('runtime') runtime?: string,
    @Query('udid') udid?: string,
    @Query('port') port?: string,
  ) {
    try {
      const effectiveClientId =
        clientId && clientId.trim() ? clientId : randomUUID();
      const effectivePort = port ? parseInt(port, 10) : 4723;
      const deviceName = device && device.trim() ? device : undefined;
      const runtimeName = runtime && runtime.trim() ? runtime : undefined;
      await this.iosService.initEnvironment({
        clientId: effectiveClientId,
        deviceName,
        runtime: runtimeName,
        udid,
        port: effectivePort,
      });
      return {
        result: 'ok',
        message: 'initializing iOS environment...',
        clientId: effectiveClientId,
        port: effectivePort,
      };
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  @ApiOperation({
    summary: 'List iOS simulators',
    description:
      'Return iOS Simulators with name, UDID, runtime, state. Use this to find a valid UDID for init.',
  })
  @ApiQuery({
    name: 'availableOnly',
    required: false,
    description: 'List only available simulators',
    schema: { type: 'boolean', default: true },
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Filter by device name (contains)',
    example: 'iPhone',
  })
  @ApiQuery({
    name: 'runtime',
    required: false,
    description: 'Filter by runtime (contains)',
    example: 'iOS-18',
  })
  @Get('devices')
  async listDevices(
    @Query('availableOnly') availableOnly?: string,
    @Query('q') q?: string,
    @Query('runtime') runtime?: string,
    @Query('clientId') clientId?: string,
  ) {
    try {
      const devices = await this.iosService.listSimulators({
        availableOnly: availableOnly !== 'false',
        name: q,
        runtime,
        clientId,
      });
      return { result: 'ok', devices };
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  @Post('simulators/start')
  async startSimulator(@Body() dto: StartSimulatorDto) {
    try {
      if (!dto.udid && !dto.deviceName) {
        throw new NotFoundException('Either udid or deviceName must be provided');
      }
      const result = await this.iosService.bootSimulator({
        udid: dto.udid,
        deviceName: dto.deviceName,
        runtime: dto.runtime,
      });
      return {
        result: 'ok',
        started: result.started,
        simulator: result.simulator,
        message: `Simulator ${result.simulator?.name ?? ''} booted`.trim(),
      };
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  @Post('simulators/stop')
  async stopSimulator(@Body() dto: StopSimulatorDto) {
    try {
      const info = await this.iosService.shutdownSimulator({ udid: dto.udid });
      return {
        result: 'ok',
        stopped: info.stopped,
        simulator: info.simulator,
        message: info.stopped
          ? `Simulator ${info.simulator?.name ?? ''} stopped`.trim()
          : 'No running simulator detected',
      };
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }
}
