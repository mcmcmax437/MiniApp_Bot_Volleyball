import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('healthz')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  health() {
    return { ok: true, service: 'volleyball-api', ts: new Date().toISOString() };
  }

  /**
   * Debug-only: returns the server's configured TELEGRAM_SUPERADMIN_ID with
   * the digits in the middle masked (only first 2 and last 2 digits shown).
   * Lets the client confirm the server has the expected value without
   * exposing the full secret. Public on purpose — if the value is wrong, it
   * doesn't help an attacker; the real check is the DB role.
   *
   * Example: "468133256" → "46…56"
   */
  @Get('superadmin-id')
  superadminId() {
    const raw = this.config.get<string>('TELEGRAM_SUPERADMIN_ID') ?? '';
    const trimmed = String(raw).trim();
    if (!trimmed) {
      return { configured: false };
    }
    if (trimmed.length <= 4) {
      return { configured: true, masked: trimmed };
    }
    const first = trimmed.slice(0, 2);
    const last = trimmed.slice(-2);
    return { configured: true, masked: `${first}…${last}`, length: trimmed.length };
  }
}
