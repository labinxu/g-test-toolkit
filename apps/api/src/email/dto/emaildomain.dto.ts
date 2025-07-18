import { IsArray, IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class EmailDomainDto {
  @ApiProperty({
    description: 'email domains ',
    example: '["gmail.com","hotmail.com"]',
  })
  @IsNotEmpty({ message: 'Cannot be empty' })
  @IsArray()
  @IsString({ each: true })
  domains: string[]

  @ApiProperty({
    description: 'mailgun apikey',
    example: 'abc',
  })
  @IsString()
  mailgunKey: string
}
