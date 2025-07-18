import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AccountDto {
  @ApiProperty({ description: 'type of account', example: 'email' })
  @IsString()
  @IsNotEmpty({ message: 'Cannot be empty' })
  type: string

  @ApiProperty({
    description: 'account field phone number or email',
    example: 'user@example.com',
  })
  @IsString()
  account: string

  @ApiProperty({
    description: 'password',
    example: 'a111111',
  })
  @IsString()
  password: string

  @ApiProperty({
    description: 'destination qa site',
    example: 'https://qa4.get.com',
  })
  @IsString()
  url: string
}
