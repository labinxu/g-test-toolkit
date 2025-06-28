import { IsString, IsNotEmpty, IsNumber, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportDto {
  @ApiProperty({ description: 'Test case name ', example: 'TestCase1' })
  @IsString()
  @IsNotEmpty({ message: 'Case name cannot be empty' })
  caseName: string;

  @ApiProperty({
    description: 'browser use',
    example: 'workspace/username/case1.html',
  })
  @IsString()
  reportPath: string;

  @ApiProperty({
    description: 'start time',
    example: '2025-06-28T09:24:00.000Z',
  })
  @IsNumber()
  startTime: number;

  @ApiProperty({ description: 'end time', example: '2025-06-28T09:24:00.000Z' })
  @IsNumber()
  endTime: number;

  @ApiProperty({ description: 'during time', example: '1234' })
  @IsNumber()
  duringTime: number;

  @ApiProperty({ description: 'status ', example: 'Passed|Failed' })
  @IsString()
  status: string;

  @ApiProperty({ description: 'message', example: 'All exception passed ' })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'details',
    example: ['step1 passed', 'step2 failed'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsString({ each: true })
  details: string[];

  @ApiProperty({
    description: 'logs',
    example: ['log1', 'log2'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsString({ each: true })
  logs: string[];
}
