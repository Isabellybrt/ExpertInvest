import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { RendaFixaService, ValidationError, ServiceError, CreateRendaFixaDTO, UpdateRendaFixaDTO } from '../services/renda-fixa.service.js';

const rendaFixaService = new RendaFixaService();

export async function rendaFixaRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/renda-fixa - List all renda fixa assets for authenticated user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const result = await rendaFixaService.list(userId);
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /api/renda-fixa/:id - Get a single renda fixa asset
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const { id } = request.params;
      const result = await rendaFixaService.findById(userId, id);
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /api/renda-fixa - Create a new renda fixa asset
  fastify.post('/', async (request: FastifyRequest<{ Body: CreateRendaFixaDTO }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const result = await rendaFixaService.create(userId, request.body);
      return reply.code(201).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PUT /api/renda-fixa/:id - Update an existing renda fixa asset
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateRendaFixaDTO }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const { id } = request.params;
      const result = await rendaFixaService.update(userId, id, request.body);
      return reply.code(200).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /api/renda-fixa/:id - Delete a renda fixa asset
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const { id } = request.params;
      await rendaFixaService.delete(userId, id);
      return reply.code(200).send({ message: 'Título de renda fixa removido com sucesso' });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ValidationError) {
    return reply.code(400).send({
      error: 'Validation Error',
      message: 'Dados inválidos',
      issues: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (error instanceof ServiceError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  // Unexpected error
  console.error('Unexpected error in renda-fixa routes:', error);
  return reply.code(500).send({
    error: 'Internal Server Error',
    message: 'Erro interno do servidor',
  });
}
