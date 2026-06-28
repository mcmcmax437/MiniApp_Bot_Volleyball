import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BlacklistService } from './blacklist.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

class AddBlacklistDto {
  @IsOptional() @IsString() blockedId?: string;
  @IsOptional() @IsString() telegramId?: string;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('blacklist')
export class BlacklistController {
  constructor(
    private readonly blacklist: BlacklistService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() me: User | null) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.blacklist.list(me);
  }

  @Post()
  async add(@CurrentUser() me: User | null, @Body() dto: AddBlacklistDto) {
    if (!me) throw new UnauthorizedException('User not found');
    let blockedId = dto.blockedId;
    if (!blockedId && dto.telegramId) {
      const u = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(dto.telegramId) },
        select: { id: true },
      });
      if (!u) throw new NotFoundException('User not found');
      blockedId = u.id;
    }
    if (!blockedId) {
      throw new BadRequestException('blockedId or telegramId required');
    }
    return this.blacklist.add(me, blockedId, dto.reason);
  }

  @Delete(':blockedId')
  remove(@CurrentUser() me: User | null, @Param('blockedId') blockedId: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.blacklist.remove(me, blockedId);
  }

  @Get('intersect')
  async intersect(
    @CurrentUser() me: User | null,
    @Query('ids') ids?: string,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    const idList = (ids ?? '').split(',').filter(Boolean);
    const set = await this.blacklist.blockedSetFor(me, idList);
    return { blocked: Array.from(set) };
  }
}