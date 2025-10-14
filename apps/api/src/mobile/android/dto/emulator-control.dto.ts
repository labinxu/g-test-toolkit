import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartEmulatorDto {
  @IsString()
  avd: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return /^(1|true|yes|on)$/i.test(value);
    }
    return false;
  })
  @IsBoolean()
  headless?: boolean = false;
}

export class StopEmulatorDto {
  @IsOptional()
  @IsString()
  serial?: string;
}
