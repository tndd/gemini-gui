import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 型定義のエクスポート
import type { Session, Message } from '@prisma/client';
export type { Session, Message };
export type SessionWithMessages = Session & { messages: Message[] };