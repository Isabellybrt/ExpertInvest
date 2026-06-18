import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';

// Import routes from backend source
import { authRoutes } from '../backend/src/routes/auth.routes.js';
import { rendaFixaRoutes } from '../backend/src/routes/renda-fixa.routes.js';
import { fiiRoutes } from '../backend/src/routes/fii.routes.js';
import { aporteRoutes } from '../backend/src/routes/aporte.routes.js';
import { exportRoutes } from '../backend/src/routes/export.routes.js';
import { dashboardRoutes } from '../backend/src/routes/dashboard.routes.js';

let app: ReturnType<typeof Fastify> | null = null;

async function buildApp() {
  if (app) return app;

  app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(rendaFixaRoutes, { prefix: '/api/renda-fixa' });
  await app.register(fiiRoutes, { prefix: '/api/fiis' });
  await app.register(aporteRoutes, { prefix: '/api/aportes' });
  await app.register(exportRoutes, { prefix: '/api/export' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });

  await app.ready();
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastify = await buildApp();

    const payload = req.method !== 'GET' && req.method !== 'HEAD' && req.body
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined;

    const response = await fastify.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as Record<string, string>,
      payload,
    });

    // Forward response headers
    const responseHeaders = response.headers;
    for (const [key, value] of Object.entries(responseHeaders)) {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    }

    res.status(response.statusCode).send(response.payload);
  } catch (error: any) {
    console.error('API Handler Error:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Unknown error',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}
