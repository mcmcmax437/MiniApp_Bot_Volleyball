import crypto from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  start_param?: string;
}

/**
 * Verify a Telegram Mini App initData string using the bot token per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24,
): TelegramInitData {
  if (!initData) throw new Error('initData is empty');

  const url = new URLSearchParams(initData);
  const hash = url.get('hash');
  if (!hash) throw new Error('initData missing hash');

  url.delete('hash');
  // build data-check-string: key=value pairs sorted by key, joined with \n
  const dataCheckString = [...url.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) throw new Error('initData signature mismatch');

  const authDate = Number(url.get('auth_date') ?? 0);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (Number.isNaN(authDate) || ageSeconds > maxAgeSeconds) {
    throw new Error('initData expired');
  }

  const userStr = url.get('user');
  const parsed: TelegramInitData = {
    auth_date: authDate,
    hash,
    query_id: url.get('query_id') ?? undefined,
    start_param: url.get('start_param') ?? undefined,
  };
  if (userStr) {
    parsed.user = JSON.parse(userStr) as TelegramUser;
  }
  return parsed;
}
