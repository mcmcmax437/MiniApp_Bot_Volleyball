import { Body, Controller, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

const PAYMENT_METHODS = ['CASH', 'BANK'] as const;

class SetPaidDto {
  @IsString() userId!: string;
  /**
   * Payment method to set. Pass `null` (or omit with clearIntent) to mark unpaid.
   * CASH / BANK → paid with that method.
   */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(PAYMENT_METHODS as unknown as string[])
  @IsOptional()
  method?: (typeof PAYMENT_METHODS)[number] | null;
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
    // null / undefined method = unpaid (nothing selected).
    const method = dto.method === undefined ? null : dto.method;
    return this.payments.setMethod(me, gameId, dto.userId, method);
  }

  @Get('payments/mine')
  listMine(@CurrentUser() me: User | null) {
    if (!me) throw new UnauthorizedException('User not found');
    return this.payments.listMine(me);
  }
}
