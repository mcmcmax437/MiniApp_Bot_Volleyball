import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

class EventDto {
  @IsString() @MaxLength(64) type!: string;
  @IsOptional() @IsString() @MaxLength(64) screen?: string;
  @IsOptional() @IsString() @MaxLength(64) target?: string;
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
}

class BatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events!: EventDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  ingest(@CurrentUser() me: User | null, @Body() dto: BatchDto) {
    return this.analytics.ingest(me, dto.events);
  }

  @Post('heartbeat')
  heartbeat(@CurrentUser() me: User | null) {
    return this.analytics.heartbeat(me!);
  }
}