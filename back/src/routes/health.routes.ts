import type { FastifyInstance } from 'fastify';

export async function healthRoutes(server: FastifyInstance) {
  server.get('/health', {
    schema: {
      tags: ['Saúde'],
      summary: 'Verificar a disponibilidade da API',
      description: 'Confirma que a API está em execução e responde a requisições. Não executa análise de recebíveis nem consulta arquivos de configuração.',
      response: {
        200: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['ok'] } },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.header('Cache-Control', 'no-store').send({ status: 'ok' });
  });
}
