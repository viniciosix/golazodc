import type { PrismaClient } from '@prisma/client';
import { expireTrades } from './market.js';
import { logger } from '../../core/logger.js';
export function startEconomyWorker(db: PrismaClient) {
  let running: Promise<void> | undefined;
  const tick = () => {
    if (running) return;
    running = db
      .$transaction((tx) => expireTrades(tx), {
        isolationLevel: 'Serializable',
        timeout: 15000,
      })
      .catch((err: unknown) => {
        logger.warn(
          { err },
          'Falha ao expirar trocas; nova tentativa no próximo ciclo',
        );
      })
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 60000).unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
