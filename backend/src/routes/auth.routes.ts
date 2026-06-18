import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, AuthError } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService();
  // POST /api/auth/register
  fastify.post(
    '/register',
    async (
      request: FastifyRequest<{ Body: { email: string; password: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;
        const result = await authService.register(email, password);
        return reply.code(201).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // POST /api/auth/login
  fastify.post(
    '/login',
    async (
      request: FastifyRequest<{ Body: { email: string; password: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;
        const result = await authService.login(email, password);
        return reply.code(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // POST /api/auth/google
  fastify.post(
    '/google',
    async (
      request: FastifyRequest<{ Body: { token: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { token } = request.body;
        const result = await authService.loginWithGoogle(token);
        return reply.code(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // POST /api/auth/refresh
  fastify.post(
    '/refresh',
    async (
      request: FastifyRequest<{ Body: { refreshToken: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { refreshToken } = request.body;
        const result = await authService.refreshToken(refreshToken);
        return reply.code(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // POST /api/auth/logout (requires authentication)
  fastify.post(
    '/logout',
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessionId = request.sessionId!;
        await authService.logout(sessionId);
        return reply.code(200).send({ message: 'Logged out successfully' });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // GET /api/auth/me (requires authentication)
  fastify.get(
    '/me',
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.code(200).send({ user: request.user });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );
}

function handleAuthError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof AuthError) {
    const statusMap: Record<string, number> = {
      EMAIL_EXISTS: 409,
      INVALID_EMAIL: 400,
      INVALID_PASSWORD: 400,
      INVALID_CREDENTIALS: 401,
      ACCOUNT_LOCKED: 423,
      INVALID_GOOGLE_TOKEN: 401,
      OAUTH_NOT_CONFIGURED: 500,
      INVALID_REFRESH_TOKEN: 401,
      INVALID_TOKEN: 401,
      SESSION_NOT_FOUND: 401,
      SESSION_EXPIRED: 401,
      USER_NOT_FOUND: 404,
    };

    const statusCode = statusMap[error.code] ?? 400;
    return reply.code(statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  console.error('Auth route unhandled error:', error);
  return reply.code(500).send({
    error: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  });
}
