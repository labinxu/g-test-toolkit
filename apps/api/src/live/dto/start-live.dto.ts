import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class StartLiveDto {
  @IsString()
  inputPath: string

  @IsOptional()
  @IsString()
  rtmpServer?: string

  @IsOptional()
  @IsString()
  streamKey?: string

  @IsOptional()
  @IsString()
  rtmpUrl?: string

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  videoBitrateKbps?: number

  @IsOptional()
  @IsInt()
  @Min(32)
  @Max(512)
  audioBitrateKbps?: number

  @IsOptional()
  @IsString()
  resolution?: string
}

