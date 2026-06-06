import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthUser; tokens: Tokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);

    let user: AuthUser;
    try {
      user = await this.prisma.user.create({
        data: { email: dto.email, password: passwordHash, role: Role.USER },
        select: { id: true, email: true, role: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refresh_token);

    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: Tokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await argon2.verify(user.password, dto.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refresh_token);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      tokens,
    };
  }

  async refresh(userId: string, rawRefreshToken: string): Promise<Tokens> {
    const stored = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
    });

    let matchedId: string | null = null;

    for (const record of stored) {
      const isMatch = await argon2.verify(record.tokenHash, rawRefreshToken);
      if (isMatch) {
        matchedId = record.id;
        break;
      }
    }

    if (!matchedId) throw new UnauthorizedException('Invalid or expired refresh token');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.refreshToken.delete({ where: { id: matchedId } });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refresh_token);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: Role,
  ): Promise<Tokens> {
    const payload = { sub: userId, email, role };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token, refresh_token };
  }

  private async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    const tokenHash = await argon2.hash(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }
}
