import { prisma, TransactionClient } from '../lib/prisma.js';
import { UserRepository } from './user.repository.js';
import { RendaFixaRepository } from './renda-fixa.repository.js';
import { FIIRepository } from './fii.repository.js';
import { AporteRepository } from './aporte.repository.js';
import { MarketIndexRepository } from './market-index.repository.js';
import { CronLogRepository } from './cron-log.repository.js';

export { UserRepository } from './user.repository.js';
export { RendaFixaRepository } from './renda-fixa.repository.js';
export { FIIRepository } from './fii.repository.js';
export { AporteRepository } from './aporte.repository.js';
export { MarketIndexRepository } from './market-index.repository.js';
export { CronLogRepository } from './cron-log.repository.js';
export type { TransactionClient } from '../lib/prisma.js';

// Singleton instances
export const userRepository = new UserRepository();
export const rendaFixaRepository = new RendaFixaRepository();
export const fiiRepository = new FIIRepository();
export const aporteRepository = new AporteRepository();
export const marketIndexRepository = new MarketIndexRepository();
export const cronLogRepository = new CronLogRepository();

/**
 * Execute multiple operations within a single database transaction.
 * If any operation fails, all changes are rolled back (Requirement 3.6).
 *
 * @param fn - A function that receives a transaction client and performs operations
 * @returns The result of the transaction function
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}
