import { Injectable, UnauthorizedException, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}
  async register(registerDto: RegisterDto): Promise<{ access_token: string }> {
    const { username, email, password } = registerDto;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // 检查用户是否存在
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 哈希密码
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建新用户
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
    });

    await this.usersRepository.save(user);

    // 生成 JWT
    const payload = { sub: user.id, username: user.username };
    const access_token = this.jwtService.sign(payload);

    return { access_token };
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const { email, password } = loginDto;
    console.log(email, password);
    // 查找用户
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 生成 JWT
    const payload = { sub: user.id, username: user.username };
    const access_token = this.jwtService.sign(payload);

    return { access_token };
  }
  async validateUser(email: string): Promise<User> {
    return this.usersRepository.findOne({ where: { email } });
  }
}
