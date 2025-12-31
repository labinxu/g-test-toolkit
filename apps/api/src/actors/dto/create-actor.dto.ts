import { IsInt, IsString, Min } from 'class-validator';

export class CreateActorDto {
  @IsString()
  accountName: string;

  @IsString()
  password: string;

  @IsInt()
  @Min(1)
  envId: number;
}

