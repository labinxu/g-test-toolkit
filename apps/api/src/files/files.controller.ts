import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify'
import * as fs from 'fs/promises'
import { createReadStream } from 'fs'
import * as path from 'path'
import { FilesService } from './files.service'
import { existsSync } from 'fs'
import * as dotenv from 'dotenv'
import { sanitizeUsername, checkPath, getErrorMessage } from 'src/common/utils'
import { FileInterceptor } from '@nest-lab/fastify-multer'
import { memoryStorage } from 'fastify-multer'
import type {
  File as FastifyMulterFile,
  FileFilter,
  FileFilterCallback,
} from 'fastify-multer/lib/interfaces'

const allowAllFileFilter: FileFilter = (_req, _file, cb: FileFilterCallback) => {
  cb(null, true)
}
dotenv.config()

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // 获取目录树
  @Get('tree')
  @UseGuards(AuthGuard('jwt'))
  async getDirTree(
    @Req() req: Request,
    @Query('dir') dir: string,
    @Query('depth') depth: number = 3
  ) {
    const dpath = checkPath(dir)
    const absPath = path.resolve(path.join(process.env.REPORTS_DIR, dpath))
    if (!existsSync(absPath)) {
      await fs.mkdir(absPath, { recursive: true })
    }
    return await this.filesService.getTree(absPath, depth)
  }
  @Get('testmodule')
  @UseGuards(AuthGuard('jwt'))
  async init(@Res() res: Response) {
    try {
      const content = this.filesService.makeTypesFile()
      res.status(200).send({ content })
    } catch (err) {
      throw new NotFoundException('make types file failed', err)
    }
  }
  @Get('testcasecommon')
  @UseGuards(AuthGuard('jwt'))
  async helper(@Res() res: Response) {
    const commonPath = path.join(__dirname, '../..', 'workspace/common_scripts/dist/index.d.ts')

    try {
      const content = await this.filesService.getTestcaseCommon(commonPath)
      res.status(200).send({ content })
    } catch (err) {
      throw new NotFoundException('make helper types file failed', err)
    }
  }
  // 获取文件内容
  @Get('script')
  @UseGuards(AuthGuard('jwt'))
  async getFile(@Query('path') filePath: string, @Res() res: Response) {
    const absP = path.join(process.env.RUNTIME_DIR, filePath)
    const absPath = path.resolve(absP)
    if (existsSync(absPath)) {
      const content = await fs.readFile(absPath, 'utf-8')
      res.status(200).send({ content })
    } else {
      res.status(200).send({ message: `file ${filePath} not found!` })
    }
  }
  @Get('read')
  @UseGuards(AuthGuard('jwt'))
  async readFile(@Query('path') filePath: string, @Res() res: Response) {
    const absPath = path.resolve(process.cwd(), filePath)
    if (!existsSync(absPath)) {
      res.status(404).send({ message: `${filePath} not found!` })
      return
    }
    const content = await fs.readFile(absPath, 'utf-8')
    res.send(content)
  }

  @Get('raw')
  @UseGuards(AuthGuard('jwt'))
  async rawFile(@Query('path') filePath: string, @Res() res: Response) {
    if (!filePath) {
      throw new NotFoundException('path is required')
    }
    const absPath = path.resolve(process.cwd(), filePath)
    if (!existsSync(absPath)) {
      throw new NotFoundException(`File ${filePath} not found`)
    }
    const ext = path.extname(absPath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.json': 'application/json',
      '.html': 'text/html',
    }
    const type = mimeMap[ext] || 'application/octet-stream'
    res.type(type)
    res.header('Content-Disposition', `inline; filename="${path.basename(absPath)}"`)
    const stream = createReadStream(absPath)
    res.send(stream)
  }
  @Get('types')
  @UseGuards(AuthGuard('jwt'))
  async types(@Res() res: Response) {
    const content = this.filesService.makeTypesFile()
    res.type('text/plain').send({ content })
  }
  // 保存文件内容
  @Put()
  @UseGuards(AuthGuard('jwt'))
  async saveFile(@Body() body: { path: string; content: string }) {
    const absPath = path.resolve(process.cwd(), body.path)
    await fs.writeFile(absPath, body.content, 'utf-8')
    return { success: true }
  }

  @Get('fast-user-db/script')
  @UseGuards(AuthGuard('jwt'))
  async getFastUserDbScript() {
    try {
      const content = await this.filesService.readFastUserDbScript()
      return { content }
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error))
    }
  }

  @Post('fast-user-db/script')
  @UseGuards(AuthGuard('jwt'))
  async saveFastUserDbScript(@Body() body: { content: string }) {
    try {
      const result = await this.filesService.saveFastUserDbScript(body?.content ?? '')
      return { success: true, path: result.path }
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error))
    }
  }
  @Post('mkdir')
  @UseGuards(AuthGuard('jwt'))
  async createDirectory(@Req() req: Request, @Body() body: { path: string }) {
    const user = req.user
    const username = sanitizeUsername(user['username'])
    let createPath = body.path
    if (!createPath.startsWith('workspace')) {
      createPath = path.join('workspace', 'users', username, 'cases', createPath)
    }
    const absPath = path.resolve(process.cwd(), createPath)
    console.log(`mkdir ${absPath}`)
    await fs.mkdir(absPath, { recursive: true })
    return { success: true }
  }

  // 新建文件
  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async createFile(@Body() body: { path: string; content?: string }, @Req() req: Request) {
    let createPath = body.path

    const user = req.user
    if (!createPath.startsWith('workspace')) {
      createPath = path.join('workspace', 'users', user['username'], 'cases', createPath)
    } else {
      console.log('startsWith found', createPath)
    }

    const absPath = path.resolve(process.cwd(), createPath)
    await fs.writeFile(absPath, '', 'utf-8')
    return { success: true }
  }
  @Delete('delete')
  @UseGuards(AuthGuard('jwt'))
  async deleteFileOrFolder(@Body() body: { path: string }) {
    const absPath = path.resolve(process.cwd(), body.path)
    try {
      const stat = await fs.lstat(absPath)
      if (stat.isDirectory()) {
        await fs.rm(absPath, { recursive: true, force: true })
      } else {
        await fs.unlink(absPath)
      }
      return { success: true }
    } catch (error) {
      let errorMsg = ''
      if (error instanceof Error) {
        errorMsg = error.message
      } else {
        errorMsg = String(error)
      }
      return { success: false, error: errorMsg }
    }
  }

  @Delete('apps')
  @UseGuards(AuthGuard('jwt'))
  async deleteAppFile(@Body() body: { path?: string }) {
    if (!body?.path) {
      throw new BadRequestException('File path is required')
    }
    try {
      const result = await this.filesService.deleteAppEntry(body.path)
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadRequestException(message)
    }
  }

  @Post('apps/upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: allowAllFileFilter,
    })
  )
  async uploadAppFile(@UploadedFile() file: FastifyMulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }
    try {
      const result = await this.filesService.saveAppFile(file.buffer, file.originalname)
      return { success: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadRequestException(message)
    }
  }
}
