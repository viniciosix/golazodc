import {
  Client,
  Events,
  GatewayIntentBits,
  type ClientEvents,
} from 'discord.js';
import { readConfig } from './config/env.js';
import { logger } from './core/logger.js';
import { loadHandlers } from './core/loader.js';
import { route } from './core/router.js';
import { createDatabase } from './infrastructure/database.js';
import { createCache, type Cache } from './infrastructure/cache.js';
import { startGoalWorker } from './modules/football/worker.js';
let stopGoalWorker: (() => Promise<void>) | undefined;
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [] },
});
const db = createDatabase();
let cache: Cache | undefined;
let stopping = false;
async function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000).unref();
  await stopGoalWorker?.();
  client.destroy();
  await Promise.allSettled([db.$disconnect(), cache?.close()]);
  clearTimeout(deadline);
  process.exitCode = code;
}
process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Falha não tratada');
  void shutdown(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Exceção não tratada');
  void shutdown(1);
});
try {
  const config = readConfig();
  const handlers = await loadHandlers();
  await db.$connect();
  await db.user.count();
  cache = await createCache(config.REDIS_URL as string | undefined);
  const context = { client, db, cache };
  for (const event of handlers.events) {
    const listener = (...args: ClientEvents[keyof ClientEvents]) => {
      void event
        .execute(context, ...args)
        .catch((err: unknown) => logger.error({ err }, 'Falha no evento'));
    };
    if (event.once) client.once(event.name, listener);
    else client.on(event.name, listener);
  }
  client.on(
    Events.InteractionCreate,
    (interaction) => void route(interaction, context, handlers),
  );
  logger.info(
    { commands: handlers.commands.size },
    'Handlers carregados; conectando ao Discord',
  );
  client.once(Events.ClientReady, () => {
    stopGoalWorker = startGoalWorker(context, config.GOAL_POLL_SECONDS);
  });
  await client.login(config.DISCORD_TOKEN);
} catch (err) {
  logger.fatal(
    { err },
    'Inicialização falhou. Verifique variáveis, banco e migrações.',
  );
  await shutdown(1);
}
