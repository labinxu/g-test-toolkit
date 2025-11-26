import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import type { FastifyRequest as Request } from 'fastify';
import type { File as FastifyMulterFile } from 'fastify-multer/lib/interfaces';

import { ApiTestsService } from './api-tests.service';
import { sanitizeUsername } from 'src/common/utils';

@Controller('api-tests')
export class ApiTestsController {
  constructor(private readonly apiTestsService: ApiTestsService) {}

  @Post('import')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
          return cb(new Error('Only .csv files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async importApis(@UploadedFile() file: FastifyMulterFile, @Req() req: Request) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    const rawUser = req.user as any;
    const username = sanitizeUsername(rawUser?.username || 'anonymous');

    const csvContent = file.buffer.toString('utf-8');

    const result = await this.apiTestsService.generateFromCsv(csvContent, username);

    return {
      result: 'ok',
      generatedCount: result.count,
      files: result.files,
    };
  }

  @Get('core-be/schema')
  @UseGuards(AuthGuard('jwt'))
  getCoreBeSchema() {
    return this.apiTestsService.getCoreBeSchema();
  }

  @Post('core-be/run')
  @UseGuards(AuthGuard('jwt'))
  async runCoreBe(@Req() req: Request, @Body() body: any) {
    const rawUser = req.user as any;
    const userId = Number(rawUser?.id || rawUser?.userId || 0);
    if (!userId) {
      throw new UnauthorizedException('No user');
    }
    return this.apiTestsService.runCoreBeTests(body, userId);
  }

  @Get('notif/schema')
  @UseGuards(AuthGuard('jwt'))
  getNotifSchema() {
    return this.apiTestsService.getNotifSchema();
  }

  @Post('notif/run')
  @UseGuards(AuthGuard('jwt'))
  async runNotif(@Req() req: Request, @Body() body: any) {
    const rawUser = req.user as any;
    const userId = Number(rawUser?.id || rawUser?.userId || 0);
    if (!userId) {
      throw new UnauthorizedException('No user');
    }
    return this.apiTestsService.runNotifTests(body, userId);
  }
}
