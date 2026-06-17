import { prisma, TransactionClient } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class AporteRepository {
  async create(
    data: Prisma.AporteUncheckedCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.aporte.create({ data });
  }

  async findByUserId(userId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.aporte.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async findByUserIdWithAssets(userId: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.aporte.findMany({
      where: { userId },
      include: {
        fii: { select: { ticker: true } },
        rendaFixa: { select: { institution: true, rateType: true, rateValue: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findByAssetId(
    assetId: string,
    assetType: 'RENDA_FIXA' | 'FII',
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    const where =
      assetType === 'RENDA_FIXA'
        ? { rendaFixaId: assetId }
        : { fiiId: assetId };

    return client.aporte.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.aporte.findUnique({ where: { id } });
  }

  async delete(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.aporte.delete({ where: { id } });
  }
}
