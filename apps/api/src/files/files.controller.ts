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
dotenv.config();

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  checkPath(dir: string) {
    if (!/^[a-zA-Z0-9_/.-]+$/.test(dir) || dir.includes('..')) {
      throw new Error('Invalid path provided');
    }
  }
  // 获取目录树
  @Get('tree')
  @UseGuards(AuthGuard('jwt'))
  async getDirTree(
    @Req() req: Request,
    @Query('dir') dir: string,
    @Query('depth') depth: number = 3,
  ) {
    this.checkPath(dir);
    const user = req.user;
    const absPath = path.normalize(
      path.join(process.cwd(), 'workspace', user['username'], dir),
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
      throw new NotFoundException('make types file failed');
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
    let createPath = body.path;
    if (!createPath.startsWith('workspace')) {
      createPath = path.join(
        'workspace',
        user['username'],
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
}
