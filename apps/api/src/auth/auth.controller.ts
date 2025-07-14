import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Get('csrf-token')
  async getCsrfToken(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    //const token = req.csrfToken();
    const token = await res.generateCsrf();
    return res.status(HttpStatus.OK).send({ csrfToken: token });
  }
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res() res: FastifyReply) {
    try {
      const { access_token } = await this.authService.register(registerDto);

      // 设置 JWT 到 cookie
      res.setCookie('access_token', access_token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
      });

      return res.status(HttpStatus.CREATED).send({
        status: 'successful',
        message: 'Registration successful',
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        return res.status(HttpStatus.CONFLICT).send({
          status: 'error',
          message: 'Email already exists',
        });
      }
      if (error instanceof BadRequestException) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          status: 'error',
          message: error.message,
        });
      }
      console.error('Registration error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'An unexpected error occurred',
      });
    }
  }
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    console.log('=======resceive login request', req.body, loginDto);
    try {
      const { access_token } = await this.authService.login(loginDto);
      // 设置 JWT 到 cookie
      res.setCookie('access_token', access_token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
      });

      return res.status(HttpStatus.OK).send({
        status: 'successful',
        message: 'Login successful',
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return res.status(HttpStatus.UNAUTHORIZED).send({
          status: 'error',
          message: 'Invalid credentials',
        });
      }
      if (error instanceof BadRequestException) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          status: 'error',
          message: (error as Error).message,
        });
      }
      console.error('Login error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'An unexpected error occurred',
      });
    }
  }
  @Get('logout')
  async logout(@Res() res: FastifyReply) {
    res.clearCookie('access_token', { path: '/' });
    return res
      .status(HttpStatus.OK)
      .send({ status: 'successful', message: 'Logout successful' });
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() request: FastifyRequest) {
    const user = request.user;
    if (!user) {
      throw new Error('User not found');
    }
    return {
      message: 'User profile',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }
}
