import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportsService, VALID_REASONS } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

class FileReportDto {
  @IsString() targetId!: string;
  @IsIn(VALID_REASONS as unknown as string[]) reason!: (typeof VALID_REASONS)[number];
  @IsOptional() @IsString() gameId?: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  file(@CurrentUser() me: User | null, @Body() dto: FileReportDto) {
    return this.reports.file(me!, dto.targetId, dto.reason, dto.gameId, dto.details);
  }

  @Get('mine')
  listMine(@CurrentUser() me: User | null) {
    return this.reports.listMine(me!);
  }
}