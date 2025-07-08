import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(user.id, {
      refreshToken: hashedRefreshToken,
    });

    return { accessToken, refreshToken };
  }
async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = this.jwtService.verify(refreshToken);
  const user = await this.userRepository.findOne({ where: { id: payload.sub } });
  if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
    throw new UnauthorizedException('Invalid refresh token');
  }
  const newPayload = { email: user.email, sub: user.id };
  const accessToken = this.jwtService.sign(newPayload, { expiresIn: '1h' });
  const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
  const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
  await this.userRepository.update(user.id, { refreshToken: hashedRefreshToken });
  return { accessToken, refreshToken: newRefreshToken };
}

  async register(registerDto: RegisterDto): Promise<User> {
    const { username, email, password } = registerDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      username,
      email,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }
  async profile(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
  async validateUser(email: string): Promise<User> {
    return this.userRepository.findOne({ where: { email } });
  }
}
