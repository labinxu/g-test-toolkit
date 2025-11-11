import { Body, Controller, Get, Post, Query, Res, UseGuards, Req, ForbiddenException, Delete } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { TraceabilityService } from './traceability.service'
import { ExportDto, SaveMappingsDto, UpsertRequirementDto } from './dto'
import { AuthGuard } from '@nestjs/passport'

@Controller('traceability')
export class TraceabilityController {
  constructor(private readonly svc: TraceabilityService) {}

  @Post('requirements')
  async upsertRequirements(@Body() body: { items: UpsertRequirementDto[] }) {
    const items = Array.isArray(body?.items) ? body.items : []
    return await this.svc.upsertRequirements(items)
  }

  @Get('requirements')
  async listRequirements() {
    return await this.svc.listRequirements()
  }

  @Get('tests')
  async listTests(@Query('user') user?: string) {
    return await this.svc.listTestsCombined(user)
  }

  @Get('tests-static')
  async listTestsStatic(@Query('user') user?: string) {
    return await this.svc.listTestsStatic(user)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  async listUsers(@Req() req: any) {
    const isAdmin = !!req?.user?.isAdmin
    if (!isAdmin) throw new ForbiddenException('Admin required')
    return await this.svc.listWorkspaceUsers()
  }

  @Get('tests-executed')
  async listTestsExecuted(@Query('user') user?: string) {
    return await this.svc.listTestsFromReports(user)
  }

  @Post('mappings')
  async saveMappings(@Body() body: SaveMappingsDto) {
    const mappings = Array.isArray(body?.mappings) ? body.mappings : []
    return await this.svc.saveMappings(mappings)
  }

  @Get('mappings')
  async listMappings() {
    return await this.svc.listMappings()
  }

  @Delete('mappings')
  async deleteMappings(
    @Body()
    body: {
      ids?: number[]
      mappings?: Array<{ requirementKey: string; testId: string }>
    }
  ) {
    return await this.svc.deleteMappings({ ids: body?.ids, mappings: body?.mappings })
  }

  @Post('export')
  async export(@Body() body: ExportDto, @Res() res: FastifyReply) {
    const fmt = body?.format || 'testrail-cases'
    const user = body?.user
    const result = await this.svc.export(fmt as any, user, {
      projectKey: body?.projectKey,
      labels: body?.labels,
      requirementKeys: Array.isArray(body?.requirementKeys) ? body?.requirementKeys : undefined,
      testIds: Array.isArray(body?.testIds) ? body?.testIds : undefined,
      testrail: body?.testrail,
    })
    res.header('Content-Type', result.contentType)
    if (result.filename) res.header('Content-Disposition', `attachment; filename=${result.filename}`)
    res.send(result.body)
  }

  @Get('suggest')
  async suggest(@Query('user') user?: string) {
    return await this.svc.suggestMappings(user)
  }

  @Post('apply-suggestions')
  async applySuggestions(@Body() body: { user?: string }) {
    return await this.svc.applySuggestions(body?.user)
  }
}
