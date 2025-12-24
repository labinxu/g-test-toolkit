import { Module } from '@nestjs/common'
import { AuthAssetsController } from './auth-assets.controller'
import { TestCaseModule } from 'src/test-cases/testcases.module'

@Module({
  imports: [TestCaseModule],
  controllers: [AuthAssetsController],
})
export class AuthAssetsModule {}

