import { randomInt } from 'node:crypto';
export const MINES = {
  cells: 16,
  minBet: 1,
  maxBet: 25,
  minBombs: 1,
  maxBombs: 8,
} as const;
export function validateSettings(bet: number, bombs: number) {
  return (
    Number.isSafeInteger(bet) &&
    bet >= MINES.minBet &&
    bet <= MINES.maxBet &&
    Number.isInteger(bombs) &&
    bombs >= MINES.minBombs &&
    bombs <= MINES.maxBombs
  );
}
export function drawBombs(count: number): number[] {
  if (!validateSettings(MINES.minBet, count))
    throw new Error('Quantidade de bombas inválida');
  const cells = Array.from({ length: MINES.cells }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = randomInt(i, cells.length);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells.slice(0, count).sort((a, b) => a - b);
}
export function rewardFraction(bombs: number, revealed: number) {
  if (
    !validateSettings(MINES.minBet, bombs) ||
    !Number.isInteger(revealed) ||
    revealed < 0 ||
    revealed > MINES.cells - bombs
  )
    throw new Error('Estado do Mines inválido');
  if (!revealed) return { numerator: 1n, denominator: 1n };
  let numerator = 95n;
  let denominator = 100n;
  for (let i = 0; i < revealed; i++) {
    numerator *= BigInt(MINES.cells - i);
    denominator *= BigInt(MINES.cells - bombs - i);
  }
  return { numerator, denominator };
}
export function payout(bet: bigint, bombs: number, revealed: number) {
  const { numerator, denominator } = rewardFraction(bombs, revealed);
  return (bet * numerator) / denominator;
}
export function multiplier(bombs: number, revealed: number) {
  const { numerator, denominator } = rewardFraction(bombs, revealed);
  return (Number(numerator) / Number(denominator)).toFixed(2);
}
