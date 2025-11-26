import { Module } from '@nestjs/common'
import { CurlController } from './curl.controller'

@Module({
  controllers: [CurlController],
})
export class CurlModule {}

