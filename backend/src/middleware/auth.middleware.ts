import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'default-dev-secret';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthPayload {
  userId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionId?: string;
  }
}

const userRepository = new UserRepository();

/**
 * Checks if a session has expired based on lastActivity timestamp.
 * A session is expired if (now - lastActivity) > 30 minutes.
 * Validates: Requirements 14.4
 */
export function isSessionExpired(lastActivity: Date): boolean {
  const now = Date.now();
  const lastActivityTime = lastActivity.getTime();
  return (now - lastActivityTime) > SESSION_TIMEOUT_MS;
}

/**
 * Fastify preHandler hook that validates JWT tokens and checks session validity.
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT signature
 * - Looks up session in DB
 * - Checks if session has expired (lastActivity > 30 minutes ago)
 * - If valid: updates lastActivity, attaches user to request
 * - If invalid/expired: returns 401 Unauthorized
 *
 * Validates: Requirements 14.4, 14.5
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Look up session in DB by session ID from JWT payload
  const session = await userRepository.findSession(payload.sessionId);

  if (!session) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Check if session has expired due to inactivity
  if (isSessionExpired(session.lastActivity)) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Update session lastActivity (track activity)
  await userRepository.updateSessionActivity(session.id);

  // Attach user info to request
  request.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
  request.sessionId = session.id;
}

/**
 * Fastify plugin that registers the auth middleware as a preHandler hook.
 * Apply this plugin to route groups that require authentication.
 *
 * Usage:
 *   fastify.register(authPlugin, { prefix: '/api/protected' });
 *
 * Or apply to individual routes:
 *   fastify.get('/api/me', { preHandler: [authMiddleware] }, handler);
 */
export async function authPlugin(fastify: ReturnType<typeof import('fastify').default>): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);
}
