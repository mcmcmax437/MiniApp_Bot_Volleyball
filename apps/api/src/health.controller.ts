import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthController {
  @Get()
  health() {
    return { ok: true, service: 'volleyball-api', ts: new Date().toISOString() };
  }
}
