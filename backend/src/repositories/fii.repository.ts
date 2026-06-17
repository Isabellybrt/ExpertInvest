import { prisma, TransactionClient } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class FIIRepository {
  async create(
    data: Prisma.FIIUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.fII.create({ data });
  }

  async findById(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fII.findUnique({
      where: { id },
      include: {
        quotes: { orderBy: { updatedAt: 'desc' }, take: 1 },
        dividends: { orderBy: { paymentDate: 'desc' }, take: 1 },
      },
    });
  }

  async findByUserId(userId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fII.findMany({
      where: { userId },
      include: {
        quotes: { orderBy: { updatedAt: 'desc' }, take: 1 },
        dividends: { orderBy: { paymentDate: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserIdWithAllDividends(userId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fII.findMany({
      where: { userId },
      include: {
        dividends: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fII.findMany({
      include: {
        quotes: { orderBy: { updatedAt: 'desc' }, take: 1 },
        dividends: { orderBy: { paymentDate: 'desc' }, take: 1 },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.FIIUpdateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.fII.update({ where: { id }, data });
  }

  async delete(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fII.delete({ where: { id } });
  }

  async createQuote(
    data: Prisma.FIIQuoteUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.fIIQuote.create({ data });
  }

  async getLatestQuote(fiiId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fIIQuote.findFirst({
      where: { fiiId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDividend(
    data: Prisma.FIIDividendUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.fIIDividend.create({ data });
  }

  async getLatestDividend(fiiId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.fIIDividend.findFirst({
      where: { fiiId },
      orderBy: { paymentDate: 'desc' },
    });
  }
}
