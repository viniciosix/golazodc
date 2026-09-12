import { PrismaClient } from '@prisma/client';
export function createDatabase() {
  return new PrismaClient({ log: [] });
}
