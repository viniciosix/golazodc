import 'dotenv/config';
import { z } from 'zod';
const optional = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
const snowflake = z.string().regex(/^\d{17,20}$/);
export const baseSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  GOAL_POLL_SECONDS: z.coerce.number().int().min(10).max(300).default(10),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:/.test(v), 'Use uma URL PostgreSQL'),
  REDIS_URL: optional(
    z
      .string()
      .url()
      .refine((v) => /^rediss?:/.test(v)),
  ),
});
export const discordSchema = z.object({
  DISCORD_TOKEN: z.string().min(20),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_GUILD_ID: optional(snowflake),
});
export function parseConfig<T extends z.ZodTypeAny>(
  schema: T,
  source = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return result.data;
}
export const readConfig = () => parseConfig(baseSchema.merge(discordSchema));
