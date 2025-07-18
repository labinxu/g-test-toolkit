import { Module } from '@nestjs/common';
import { AndroidModule } from './mobile/android/android.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { CommandModule } from './command/command.module';
import { LoggerService } from './logger/logger.service';
import { TestCaseModule } from './test-cases/testcases.module';
import { LoggerGateway } from './logger/logger.gateway';
import { FilesModule } from './files/files.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { TestCase } from './report/entities/testcase.entity';
import { ReportModule } from './report/report.module';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data/auth_db.sqlite',
      entities: [User, TestCase],
      synchronize: true,
    }),
    AndroidModule,
    CommandModule,
    TestCaseModule,
    FilesModule,
    AuthModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService, LoggerGateway],
})
export class AppModule {}
