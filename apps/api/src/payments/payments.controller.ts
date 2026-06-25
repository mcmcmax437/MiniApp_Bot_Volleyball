import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

class SetPaidDto {
  @IsString() userId!: string;
  @IsBoolean() isPaid!: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('games/:gameId/payments')
  listForGame(@CurrentUser() me: User | null, @Param('gameId') gameId: string) {
    return this.payments.listForGame(me!, gameId);
  }

  @Post('games/:gameId/payments')
  setPaid(
    @CurrentUser() me: User | null,
    @Param('gameId') gameId: string,
    @Body() dto: SetPaidDto,
  ) {
    return this.payments.setPaid(me!, gameId, dto.userId, dto.isPaid);
  }

  @Get('payments/mine')
  listMine(@CurrentUser() me: User | null) {
    return this.payments.listMine(me!);
  }
}