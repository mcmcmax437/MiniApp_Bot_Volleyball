import { Body, Controller, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

const PAYMENT_METHODS = ['CASH'] as const;

class SetPaidDto {
  @IsString() userId!: string;
  @IsBoolean() isPaid!: boolean;
  /** How they paid. Defaults to CASH when marking paid; cleared when unpaid. */
  @IsOptional()
  @IsIn(PAYMENT_METHODS as unknown as string[])
  method?: (typeof PAYMENT_METHODS)[number];
}

@UseGuards(JwtAuthGuard, NotBannedGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('games/:gameId/payments')
  listForGame(@CurrentUser() me: User | null, @Param('gameId') gameId: string) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.payments.listForGame(me, gameId);
  }

  @Post('games/:gameId/payments')
  setPaid(
    @CurrentUser() me: User | null,
    @Param('gameId') gameId: string,
    @Body() dto: SetPaidDto,
  ) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.payments.setPaid(me, gameId, dto.userId, dto.isPaid, dto.method);
  }

  @Get('payments/mine')
  listMine(@CurrentUser() me: User | null) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.payments.listMine(me);
  }
}
