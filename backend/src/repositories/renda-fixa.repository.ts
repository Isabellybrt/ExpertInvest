import { prisma, TransactionClient } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class RendaFixaRepository {
  async create(
    data: Prisma.RendaFixaUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.rendaFixa.create({ data });
  }

  async findById(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.rendaFixa.findUnique({ where: { id } });
  }

  async findByUserId(userId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.rendaFixa.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.RendaFixaUpdateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.rendaFixa.update({ where: { id }, data });
  }

  async delete(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.rendaFixa.delete({ where: { id } });
  }
}
