import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Requirement } from './entities/requirement.entity'
import { ReqTestMap } from './entities/req-test-map.entity'
import { TraceabilityService } from './traceability.service'
import { TraceabilityController } from './traceability.controller'
import { SettingsModule } from 'src/settings/settings.module'
import { ExportConfigController } from './export-config.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Requirement, ReqTestMap]), SettingsModule],
  providers: [TraceabilityService],
  controllers: [TraceabilityController, ExportConfigController],
})
export class TraceabilityModule {}
