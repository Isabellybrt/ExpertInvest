import { prisma, TransactionClient } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findByEmail(email: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.user.findUnique({ where: { email } });
  }

  async findById(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.user.findUnique({ where: { id } });
  }

  async create(
    data: Prisma.UserCreateInput,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.user.create({ data });
  }

  async updateLoginAttempts(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id },
      data: { failedLoginAttempts, lockedUntil },
    });
  }

  async createSession(
    data: { userId: string; token: string; expiresAt: Date },
    tx?: TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.session.create({ data });
  }

  async findSession(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.session.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findSessionByToken(token: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.session.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async updateSessionActivity(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.session.update({
      where: { id },
      data: { lastActivity: new Date() },
    });
  }

  async deleteSession(id: string, tx?: TransactionClient) {
    const client = tx ?? prisma;
    return client.session.delete({ where: { id } });
  }
}
