import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';

export async function ensureAdminOrBootstrap(
  repo: Repository<User>,
  req: any,
): Promise<void> {
  const user = req?.user as any;
  if (!user) throw new UnauthorizedException('No user');
  const hasAnyAdmin = (await repo.count({ where: { isAdmin: true } })) > 0;
  if (hasAnyAdmin && !user.isAdmin) {
    throw new ForbiddenException('Admin required');
  }
}
