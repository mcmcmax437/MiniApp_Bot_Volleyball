import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';

class UpdateMeDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'])
  skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminderOffsets?: number[];
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() me: User | null) {
    return me;
  }

  @Patch()
  async update(@CurrentUser() me: User | null, @Body() dto: UpdateMeDto) {
    if (!me) return null;
    const updated = await this.prisma.user.update({
      where: { id: me.id },
      data: {
        age: dto.age ?? undefined,
        skillLevel: dto.skillLevel ?? undefined,
        city: dto.city ?? undefined,
        reminderOffsets: dto.reminderOffsets ?? undefined,
      },
    });
    return updated;
  }
}
