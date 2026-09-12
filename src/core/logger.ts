import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'token',
      'password',
      'DISCORD_TOKEN',
      'DATABASE_URL',
      'REDIS_URL',
      'authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: (error: unknown) => ({
      type: error instanceof Error ? error.name : 'UnknownError',
    }),
  },
});
