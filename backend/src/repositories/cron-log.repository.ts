import { prisma, TransactionClient } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class CronLogRepository {
  async create(
    data: Prisma.CronLogCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.cronLog.create({ data });
  }

  async getLatest(tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.cronLog.findFirst({
      orderBy: { executionDate: 'desc' },
    });
  }
}
