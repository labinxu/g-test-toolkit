import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorsController } from './actors.controller';
import { ActorsService } from './actors.service';
import { Actor } from './entities/actor.entity';
import { ActorEnv } from './entities/actor-env.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Actor, ActorEnv])],
  controllers: [ActorsController],
  providers: [ActorsService],
})
export class ActorsModule {}

