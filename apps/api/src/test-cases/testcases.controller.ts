import {
  Controller,
  Post,
  Get,
  Res,
  Req,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { statSync, mkdirSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { FastifyReply as Response } from 'fastify';
//import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TestCasesService } from './testcases.service';
import { FilesService } from 'src/files/files.service';
import { existsSync } from 'fs';
import { FastifyRequest as Request } from 'fastify';
@Controller('testcase')
export class TestCasesController {
  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly filesService: FilesService,
  ) {}

  @Post('/')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseName: {
          type: 'string',
          description: 'The name of the test case',
          example: 'TestCase1',
        },
      },
      required: ['file', 'caseName'],
    },
  })
  @Get('execute')
  @UseGuards(AuthGuard('jwt'))
  async execute(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    const reportDir = path.dirname(scriptpath).replace('cases', 'reports');
    try {
      const absPath = path.resolve(process.cwd(), scriptpath);
      const stat = statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        this.testCasesService.executeFile(absPath, clientId, reportDir);
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
      }
      //this.testCasesService.runDir(scriptpath);
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }
  @Get('listcases')
  @UseGuards(AuthGuard('jwt'))
  async listCases(@Req() req: Request, @Query('depth') depth: number = 3) {
    const user = req.user;
    const absPath = path.normalize(
      path.join(process.cwd(), 'workspace', user['username'], 'cases'),
    );
    const baseDir = path.resolve(process.cwd());
    if (!absPath.startsWith(baseDir)) {
      throw new Error(
        'Access to paths outside the working directory is forbidden',
      );
    }
    return await this.filesService.getTree(absPath, depth);
  }
  @Get('bundle')
  @UseGuards(AuthGuard('jwt'))
  async executeBundle(
    @Query('scriptpath') scriptpath: string,
    @Query('clientId') clientId: string,
  ) {
    console.log('clientid', clientId);
    try {
      const absPath = path.resolve(process.cwd(), scriptpath);
      const stat = statSync(absPath);
      let message = '';
      if (stat.isFile()) {
        const reportDir = path.dirname(absPath).replace('cases', 'reports');
        if (!existsSync(reportDir)) {
          mkdirSync(reportDir, { recursive: true });
        }
        this.testCasesService.executeFile(absPath, clientId, reportDir);
        message = `execute file ${absPath}`;
      } else if (stat.isDirectory()) {
        message = `execute dir ${absPath}`;
        const reportDir = absPath.replace('cases', 'reports');
        if (!existsSync(reportDir)) {
          mkdirSync(reportDir, { recursive: true });
        }
        const filesContent: { [filename: string]: string } = {};
        const files = await readdir(absPath);
        if (files.length === 0) {
          return { message: 'no files', clientId };
        }
        await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(absPath, file);
            console.log(fullPath);
            filesContent[fullPath] = await readFile(fullPath, 'utf-8');
          }),
        );

        this.testCasesService.executeTestFiles(
          filesContent,
          clientId,
          reportDir,
        );
      }
      return { message, clientId };
    } catch (err) {
      throw new NotFoundException(err);
    }
  }

  @Get('init')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile();
      res.type('text/plian');
      res.send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed');
    }
  }
}
