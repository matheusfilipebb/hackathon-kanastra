import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { errorSchema } from '../docs/schemas.js';
import { uploadRecebiveis } from '../controllers/recebiveis.controller.js';
import { readUploadLimits, UploadLimitsService } from '../services/upload-limits.service.js';
import type { UploadLimits } from '../services/upload-limits.service.js';

export async function recebiveisRoutes(server: FastifyInstance, options: { uploadLimits?: UploadLimits } = {}) {
  const limiter = new UploadLimitsService(options.uploadLimits ?? readUploadLimits());
  const leases = new WeakMap<object, () => void>();
  const release = (request: object) => { leases.get(request)?.(); leases.delete(request); };
  await server.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024 },
  });

  server.post('/recebiveis/upload', {
    onRequest: async (request, reply) => {
      const admission = limiter.acquire();
      if ('code' in admission) {
        return reply.header('Retry-After', admission.retryAfter).code(429).send({ statusCode: 429, code: admission.code, message: admission.message });
      }
      leases.set(request, admission.release);
      // An incomplete upload cannot start analysis; a disconnect after receiving the
      // full body retains the slot until the handler's finally block finishes.
      request.raw.once('aborted', () => { if (!request.raw.complete) release(request); });
    },
    onResponse: async request => { release(request); },
    onError: async request => { release(request); },
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
        + 'As concentrações são reavaliadas até não ocorrerem novas recusas. '
        + 'Notas aprovadas recebem precificacao com desconto simples entre aquisição e vencimento, '
        + 'usando taxa mensal e base de dias da configuração.',
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
              precificacao: {
                type: 'object',
                description: 'Presente somente para notas aprovadas após todas as validações. Valores monetários em reais.',
                required: ['metodo', 'taxa_mensal_percentual', 'base_dias', 'prazo_dias', 'valor_nominal', 'valor_desconto', 'valor_liquido'],
                properties: {
                  metodo: { type: 'string', enum: ['DESCONTO_SIMPLES'] },
                  taxa_mensal_percentual: { type: 'number', minimum: 0 },
                  base_dias: { type: 'integer', minimum: 1 },
                  prazo_dias: { type: 'integer', minimum: 0, description: 'Vencimento menos aquisição em dias civis.' },
                  valor_nominal: { type: 'number', minimum: 0 },
                  valor_desconto: { type: 'number', minimum: 0 },
                  valor_liquido: { type: 'number', minimum: 0 },
                },
              },
            },
          },
          examples: [[
            { linha: 2, id: '000123', status: 'APROVADO', precificacao: {
              metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30,
              prazo_dias: 60, valor_nominal: 1000, valor_desconto: 40, valor_liquido: 960,
            } },
            { linha: 3, id: '1-759172', status: 'BARRADO', barrado_por: ['CONCENTRACAO_MAXIMA_SACADO'] },
          ]],
        },
        400: errorSchema, 413: errorSchema, 415: errorSchema, 422: errorSchema, 429: errorSchema, 500: errorSchema,
      },
    },
  }, async (request, reply) => {
    try { return await uploadRecebiveis(request, reply); }
    finally { release(request); }
  });
}
