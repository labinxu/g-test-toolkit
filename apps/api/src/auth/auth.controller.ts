import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async profile(@Request() req) {
    return this.authService.profile(req.user.sub);
  }
  // src/auth/auth.controller.ts
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    // Validate and generate new accessToken
    return this.authService.refresh(refreshToken);
  }
}
