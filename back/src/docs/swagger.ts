import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export async function registerDocumentation(server: FastifyInstance) {
  await server.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Antecipe API',
        version: '0.1.0',
        description: 'Upload de recebíveis e configuração dos validadores. '
          + 'O upload ainda retorna o gabarito fixo, sem executar as regras de elegibilidade.',
      },
      tags: [
        { name: 'Recebíveis', description: 'Envio de notas em CSV.' },
        { name: 'Validadores', description: 'Consulta e atualização da configuração persistida em JSON.' },
      ],
    },
    transform: ({ schema, url }) => {
      if (url !== '/recebiveis/upload') return { schema, url };
      // Descreve o arquivo no OpenAPI sem alterar o parser multipart da rota.
      return {
        url,
        schema: {
          ...schema,
          consumes: ['multipart/form-data'],
          body: {
            type: 'object',
            required: ['file'],
            properties: {
              file: { type: 'string', format: 'binary', description: 'CSV em UTF-8, até 50 MiB.' },
            },
          },
        },
      };
    },
  });
  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });
}
