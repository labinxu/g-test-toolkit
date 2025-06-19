import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ScreenOnDto {
  @ApiProperty({
    example: '0A171FDD40063C',
    required: true,
  })
  @IsString()
  readonly deviceId: string;
  @ApiProperty({
    example:'holding display',
    required:true})
  readonly checkKeywords:string;

  @ApiProperty({
    example: '125698',
    required: true,
  })
  @IsString()
  readonly password: string;

  @ApiProperty({
    example: '300 900 300 200',
    required: true,
  })
  @IsString()
  readonly swipeCord: string;
}
