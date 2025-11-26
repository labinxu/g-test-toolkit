import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FlutterService } from './flutter.service';
import { FlutterMeta } from './types';

@Controller('flutter')
export class FlutterController {
  constructor(private readonly flutterService: FlutterService) {}

  @Get('meta')
  async listMeta() {
    return this.flutterService.listMetaFiles();
  }

  @Get('meta/:sanitizedBranch')
  async getMeta(@Param('sanitizedBranch') sanitizedBranch: string) {
    return this.flutterService.getMetaByBranch(sanitizedBranch);
  }

  /**
   * Generate Flutter TS PageObject classes from uploaded metadata JSON.
   *
   * Expects the JSON produced by scripts/scan-flutter-pages.js.
   */
  @Post('page-objects')
  async generatePageObjects(@Body() meta: FlutterMeta) {
    return this.flutterService.generateFromMeta(meta);
  }

  @Post('page-objects/by-branch')
  async generatePageObjectsByBranch(
    @Body()
    body: {
      sanitizedBranch?: string;
      branch?: string;
      platform?: string;
      language?: string;
    },
  ) {
    const sanitized = body?.sanitizedBranch;
    if (!sanitized) {
      throw new BadRequestException('sanitizedBranch is required');
    }
    const platform = body.platform?.toString().toLowerCase();
    const language = body.language?.toString().toLowerCase();
    return this.flutterService.generateFromStoredMeta(sanitized, {
      platform,
      language,
    });
  }
}
