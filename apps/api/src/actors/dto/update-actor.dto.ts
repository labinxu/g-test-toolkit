import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateActorDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  envId?: number;
}

