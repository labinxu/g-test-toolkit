import {
  Controller,
  Get,
  Query,
  Put,
  Body,
  Post,
  Req,
  Res,
  UseGuards,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FilesService } from './files.service';
import { existsSync } from 'fs';
import * as dotenv from 'dotenv';
import { sanitizeUsername, checkPath } from 'src/common/utils';
dotenv.config();

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // 获取目录树
  @Get('tree')
  @UseGuards(AuthGuard('jwt'))
  async getDirTree(
    @Req() req: Request,
    @Query('dir') dir: string,
    @Query('depth') depth: number = 3,
  ) {
    const dpath = checkPath(dir);
    const user = req.user;
    const username = sanitizeUsername(user['username']);
    const absPath = path.normalize(
      path.join(process.cwd(), 'workspace', 'users', username, dpath),
    );
    const baseDir = path.resolve(process.cwd());
    if (!absPath.startsWith(baseDir)) {
      throw new Error(
        'Access to paths outside the working directory is forbidden',
      );
    }
    if (!existsSync(absPath)) {
      await fs.mkdir(absPath, { recursive: true });
    }
    return await this.filesService.getTree(absPath, depth);
  }
  @Get('testmodule')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile();
      res.status(200).send({ content });
    } catch (err) {
      throw new NotFoundException('make types file failed', err);
    }
  }
  @Get('testcasecommon')
  @UseGuards(AuthGuard('jwt'))
  async helper(@Res() res: Response) {
    const commonPath = path.join(
      __dirname,
      '../..',
      'workspace/common_scripts/dist/index.d.ts',
    );

    try {
      const content = await this.filesService.getTestcaseCommon(commonPath);
      res.status(200).send({ content });
    } catch (err) {
      throw new NotFoundException('make helper types file failed', err);
    }
  }
  // 获取文件内容
  @Get('script')
  @UseGuards(AuthGuard('jwt'))
  async getFile(@Query('path') filePath: string, @Res() res: Response) {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    res.status(200).send({ content });
  }
  @Get('read')
  @UseGuards(AuthGuard('jwt'))
  async readFile(@Query('path') filePath: string, @Res() res: Response) {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    res.send(content);
  }
  @Get('types')
  @UseGuards(AuthGuard('jwt'))
  async types(@Res() res: Response) {
    const content = this.filesService.makeTypesFile();
    res.type('text/plain').send({ content });
  }
  // 保存文件内容
  @Put()
  @UseGuards(AuthGuard('jwt'))
  async saveFile(@Body() body: { path: string; content: string }) {
    const absPath = path.resolve(process.cwd(), body.path);
    await fs.writeFile(absPath, body.content, 'utf-8');
    return { success: true };
  }
  @Post('mkdir')
  @UseGuards(AuthGuard('jwt'))
  async createDirectory(@Req() req: Request, @Body() body: { path: string }) {
    const user = req.user;
    const username = sanitizeUsername(user['username']);
    let createPath = body.path;
    if (!createPath.startsWith('workspace')) {
      createPath = path.join(
        'workspace',
        'users',
        username,
        'cases',
        createPath,
      );
    }
    const absPath = path.resolve(process.cwd(), createPath);
    console.log(`mkdir ${absPath}`);
    await fs.mkdir(absPath, { recursive: true });
    return { success: true };
  }

  // 新建文件
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createFile(
    @Body() body: { path: string; content?: string },
    @Req() req: Request,
  ) {
    let createPath = body.path;

    const user = req.user;
    if (!createPath.startsWith('workspace')) {
      createPath = path.join(
        'workspace',
        'users',
        user['username'],
        'cases',
        createPath,
      );
    } else {
      console.log('startsWith found', createPath);
    }

    const absPath = path.resolve(process.cwd(), createPath);
    await fs.writeFile(absPath, '', 'utf-8');
    return { success: true };
  }
  @Delete('delete')
  @UseGuards(AuthGuard('jwt'))
  async deleteFileOrFolder(@Body() body: { path: string }) {
    const absPath = path.resolve(process.cwd(), body.path);
    try {
      const stat = await fs.lstat(absPath);
      if (stat.isDirectory()) {
        await fs.rm(absPath, { recursive: true, force: true });
      } else {
        await fs.unlink(absPath);
      }
      return { success: true };
    } catch (error) {
      let errorMsg = '';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else {
        errorMsg = String(error);
      }
      return { success: false, error: errorMsg };
    }
  }

  @Get('buildhelper')
  //@UseGuards(AuthGuard('jwt'))
  async buildHelperModule(@Res() res: Response) {
    await this.filesService.generateModule();
    return res.send({ code: 'ok' });
  }
}
