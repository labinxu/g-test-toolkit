import { Module } from '@nestjs/common'
import { LoggerModule } from 'src/logger/logger.module'
import { TestAccountService } from './testaccount.service'
import { TestAccountController } from './testaccount.controller'

@Module({
  imports: [LoggerModule],
  controllers: [TestAccountController],
  providers: [TestAccountService],
})
export class TestAccountModule { }
