import { prisma, TransactionClient } from '../lib/prisma.js';
import { IndexType, Prisma } from '@prisma/client';

export class MarketIndexRepository {
  async getLatest(indexType: IndexType, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.marketIndex.findFirst({
      where: { indexType },
      orderBy: { date: 'desc' },
    });
  }

  async create(
    data: Prisma.MarketIndexUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.marketIndex.upsert({
      where: {
        indexType_date: {
          indexType: data.indexType,
          date: data.date as Date,
        },
      },
      create: data,
      update: { value: data.value },
    });
  }

  async findByTypeAndDate(
    indexType: IndexType,
    date: Date,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.marketIndex.findUnique({
      where: {
        indexType_date: { indexType, date },
      },
    });
  }
}
