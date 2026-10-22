import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { errorSchema } from '../docs/schemas.js';
import { uploadRecebiveis } from '../controllers/recebiveis.controller.js';

export async function recebiveisRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024 },
  });

  server.post('/recebiveis/upload', {
    schema: {
      tags: ['Recebíveis'],
      summary: 'Enviar um CSV de recebíveis',
      description: 'Envie o arquivo no campo file de multipart/form-data (até 50 MiB). '
        + 'Formato UTF-8, separador ponto e vírgula, decimal com vírgula e datas dd/mm/aaaa. '
        + 'Cabeçalho: NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;'
        + 'NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO. '
        + 'Aplica as regras individuais ativas e depois as concentrações por fundo. '
        + 'Usa DATA_AQUISICAO de cada nota como referência dos prazos e vencimento. '
        + 'Retorna apenas as notas enviadas, na ordem original, com todos os motivos individuais de recusa. '
        + 'As concentrações são reavaliadas até não ocorrerem novas recusas.',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            required: ['linha', 'id', 'status'],
            properties: {
              linha: { type: 'integer', description: 'Linha do CSV de referência; o cabeçalho é a linha 1.' },
              id: { type: 'string', description: 'NU_DOCUMENTO, preservando zeros à esquerda.' },
              status: { type: 'string', enum: ['APROVADO', 'BARRADO'] },
              barrado_por: { type: 'array', items: { type: 'string' }, description: 'Códigos das regras que recusaram a nota.' },
            },
          },
          examples: [[
            { linha: 2, id: '725714', status: 'APROVADO' },
            { linha: 3, id: '1-759172', status: 'BARRADO', barrado_por: ['CONCENTRACAO_MAXIMA_SACADO'] },
          ]],
        },
        400: errorSchema, 413: errorSchema, 415: errorSchema, 500: errorSchema,
      },
    },
  }, uploadRecebiveis);
}
