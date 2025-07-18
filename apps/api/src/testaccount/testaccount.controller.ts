import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { ApiParam, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { TestAccountService } from './testaccount.service'
import { AccountDto } from './dto/account.dto'

@Controller('testaccount')
export class TestAccountController {
  constructor(private readonly testaccountService: TestAccountService) { }

  @Get('email/:email')
  @ApiOperation({ summary: 'Create or retrieve user by email' }) // 描述接口功能
  @ApiParam({
    name: 'email', // 参数名称
    description: 'The email of the user', // 参数描述
    type: String, // 参数类型
    required: true, // 是否必填
    example: 'user@example.com', // 示例值
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved or created user',
  })
  async email(@Param('email') email: string) {
    console.log('==========create', email)
  }
  @Get('phone/:phonenumber')
  @ApiOperation({ summary: 'Create or  user by phone' }) // 描述接口功能
  @ApiParam({
    name: 'phonenumber', // 参数名称
    description: 'The phone number of account', // 参数描述
    type: String, // 参数类型
    required: true, // 是否必填
    example: '12345567', // 示例值
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved or created user',
  })
  async phonenumber(@Param('phonenumber') phonenumber: string) {
    console.log('==========create', phonenumber)
  }
  @Post('email')
  async email_account(@Body() accountDto: AccountDto) {
    console.log(accountDto)
    return accountDto
  }
  @Post('phonenumber')
  async phone_account(@Body() accountDto: AccountDto) {
    console.log(accountDto)
    return await this.testaccountService.getPhoneVerifyCode(accountDto.account)
  }
}
