import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { FIIService, FIIServiceError } from '../services/fii.service.js';
import type { CreateFIIDTO, UpdateFIIDTO } from '../services/fii.service.js';
import { FIIPortfolioService } from '../services/fii-portfolio.service.js';
import { FIIRepository } from '../repositories/fii.repository.js';

const fiiService = new FIIService();
const fiiRepository = new FIIRepository();
const fiiPortfolioService = new FIIPortfolioService({ fiiRepository });

export async function fiiRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/fiis - List all FIIs for the authenticated user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const fiis = await fiiService.list(userId);
      return reply.code(200).send(fiis);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /api/fiis - Create a new FII
  fastify.post('/', async (request: FastifyRequest<{ Body: CreateFIIDTO }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const fii = await fiiService.create(userId, request.body);
      return reply.code(201).send(fii);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /api/fiis/portfolio - Get consolidated portfolio data
  // MUST be registered BEFORE /:id parametric routes
  fastify.get('/portfolio', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const portfolio = await fiiPortfolioService.getPortfolio(userId);
      return reply.code(200).send(portfolio);
    } catch (error) {
      console.error('Portfolio error:', error);
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
    }
  });

  // PUT /api/fiis/:id - Update an existing FII
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateFIIDTO }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const { id } = request.params;
      const fii = await fiiService.update(id, userId, request.body);
      return reply.code(200).send(fii);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /api/fiis/:id - Delete a FII
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const { id } = request.params;
      await fiiService.delete(id, userId);
      return reply.code(200).send({ message: 'FII deleted successfully' });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof FIIServiceError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Unexpected errors
  return reply.code(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
