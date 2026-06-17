import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { AporteService, AporteServiceError } from '../services/aporte.service.js';
import type { CreateAporteDTO } from '../services/aporte.service.js';

const aporteService = new AporteService();

export async function aporteRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/aportes - List all aportes for the authenticated user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const aportes = await aporteService.listByUser(userId);
      return reply.code(200).send(aportes);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /api/aportes/assets - List user's registered assets for dropdown selection
  fastify.get('/assets', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const assets = await aporteService.listUserAssets(userId);
      return reply.code(200).send(assets);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /api/aportes/:assetId - Get aportes for a specific asset
  fastify.get(
    '/:assetId',
    async (
      request: FastifyRequest<{ Params: { assetId: string }; Querystring: { assetType?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { assetId } = request.params;
        const assetType = (request.query as any).assetType as 'RENDA_FIXA' | 'FII' | undefined;

        if (!assetType || !['RENDA_FIXA', 'FII'].includes(assetType)) {
          return reply.code(400).send({
            error: 'VALIDATION_ERROR',
            message: 'Query parameter assetType is required and must be RENDA_FIXA or FII',
          });
        }

        const aportes = await aporteService.listByAsset(assetId, assetType);
        return reply.code(200).send(aportes);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /api/aportes - Register a new aporte
  fastify.post(
    '/',
    async (request: FastifyRequest<{ Body: CreateAporteDTO }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const aporte = await aporteService.registerAporte(userId, request.body);
        return reply.code(201).send(aporte);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // DELETE /api/aportes/:id - Delete an aporte and reverse its effect
  fastify.delete(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;
        await aporteService.deleteAporte(userId, id);
        return reply.code(204).send();
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof AporteServiceError) {
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
