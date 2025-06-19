import { Module } from '@nestjs/common';

import {AndroidModule} from './mobile/android/android.module';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { CommandModule } from './command/command.module';

@Module({
  imports: [AndroidModule,CommandModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
