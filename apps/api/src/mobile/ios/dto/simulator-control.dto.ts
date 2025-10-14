import { IsOptional, IsString } from 'class-validator';

export class StartSimulatorDto {
  @IsOptional()
  @IsString()
  udid?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  runtime?: string;
}

export class StopSimulatorDto {
  @IsOptional()
  @IsString()
  udid?: string;
}
