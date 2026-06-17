import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { ExportService, ExportTimeoutError } from '../services/export.service.js';

const exportService = new ExportService();

/**
 * Export routes plugin.
 * POST /api/export/csv  - Generate and download CSV
 * POST /api/export/excel - Generate and download Excel
 *
 * All routes require authentication.
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */
export async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // POST /api/export/csv
  fastify.post('/csv', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const buffer = await exportService.generateCSV(userId);

      return reply
        .code(200)
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="portfolio-export.csv"')
        .send(buffer);
    } catch (error) {
      return handleExportError(error, reply);
    }
  });

  // POST /api/export/excel
  fastify.post('/excel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const buffer = await exportService.generateExcel(userId);

      return reply
        .code(200)
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="portfolio-export.xlsx"')
        .send(buffer);
    } catch (error) {
      return handleExportError(error, reply);
    }
  });
}

function handleExportError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ExportTimeoutError) {
    return reply.code(408).send({
      error: 'EXPORT_TIMEOUT',
      message: 'A exportação não pôde ser concluída. O processamento excedeu o tempo limite de 30 segundos.',
    });
  }

  return reply.code(500).send({
    error: 'EXPORT_ERROR',
    message: 'A exportação não pôde ser concluída. Tente novamente.',
  });
}
