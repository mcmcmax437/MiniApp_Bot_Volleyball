/**
 * Client-side "I'm done rating this game" flag.
 *
 * When a participant presses X / Skip on the post-game rating modal (or
 * successfully submits ratings), we mark the game id here so we never
 * auto-prompt them again for that game — even if the server still lists
 * it as pending (e.g. they dismissed without submitting).
 *
 * Device-local is enough: Telegram Mini Apps run on one phone at a time,
 * and the server already stops listing a game once any evaluation rows
 * exist for that evaluator.
 */
const KEY = 'volley:eval-done:v1';

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isEvalDone(gameId: string): boolean {
  return readSet().has(gameId);
}

export function markEvalDone(gameId: string): void {
  const set = readSet();
  if (set.has(gameId)) return;
  set.add(gameId);
  writeSet(set);
}
