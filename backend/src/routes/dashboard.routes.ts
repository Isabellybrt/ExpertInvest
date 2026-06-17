import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { DashboardService } from '../services/dashboard.service.js';
import { CalculationService } from '../services/calculation.service.js';
import { CronService } from '../services/cron.service.js';
import {
  fiiRepository,
  rendaFixaRepository,
  marketIndexRepository,
  cronLogRepository,
} from '../repositories/index.js';
import { MarketDataService } from '../services/market-data.service.js';

// Create service instances
const calculationService = new CalculationService();
const marketDataService = new MarketDataService();
const cronService = new CronService({
  marketDataService,
  fiiRepository,
  cronLogRepository,
});

const dashboardService = new DashboardService({
  calculationService,
  cronService,
  fiiRepository,
  rendaFixaRepository,
  marketIndexRepository,
});

/**
 * Dashboard routes plugin.
 * All routes are auth-protected and serve data from local cache.
 *
 * Validates: Requirements 8.1, 8.2, 9.1, 9.2, 10.1, 10.2
 */
export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /api/dashboard/summary
   * Returns portfolio summary: total patrimony, allocation percentages, estimated dividends.
   */
  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const summary = await dashboardService.getSummary(userId);
      return reply.code(200).send(summary);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /api/dashboard/patrimony-history
   * Returns patrimony evolution with monthly granularity (1-60 months).
   * Optional query param: ?months=12 (default: all available, max 60)
   */
  fastify.get(
    '/patrimony-history',
    async (
      request: FastifyRequest<{ Querystring: { months?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = request.user!.id;
        const monthsParam = (request.query as { months?: string }).months;
        const months = monthsParam ? Math.min(Math.max(parseInt(monthsParam, 10), 1), 60) : undefined;

        const history = await dashboardService.getPatrimonyHistory(userId, months);
        return reply.code(200).send(history);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /api/dashboard/dividends
   * Returns dividend history (last 12 months) + projection (next 6 months).
   */
  fastify.get('/dividends', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const dividends = await dashboardService.getDividends(userId);
      return reply.code(200).send(dividends);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /api/dashboard/allocation
   * Returns allocation breakdown by asset class.
   */
  fastify.get('/allocation', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const allocation = await dashboardService.getAllocation(userId);
      return reply.code(200).send(allocation);
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  console.error('[Dashboard] Error:', error);
  return reply.code(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
