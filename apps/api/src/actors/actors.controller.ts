import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActorsService } from './actors.service';
import { CreateActorDto } from './dto/create-actor.dto';
import { UpdateActorDto } from './dto/update-actor.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('actors')
export class ActorsController {
  constructor(private readonly actors: ActorsService) {}

  @Get('environments')
  async listEnvs() {
    return this.actors.listEnvs();
  }

  @Get()
  async listActors() {
    return this.actors.listActors();
  }

  @Post()
  async create(@Body() dto: CreateActorDto) {
    return this.actors.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateActorDto) {
    return this.actors.update(Number(id), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.actors.remove(Number(id));
  }
}

