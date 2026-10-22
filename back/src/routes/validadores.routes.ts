import type { FastifyInstance } from 'fastify';
import {
  getValidadores, setValidadores,
} from '../controllers/validadores.controller.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

const configuracaoSchema = {
  type: 'object',
  required: ['fundo', 'validadores', 'precificacao'],
  properties: {
    fundo: {
      type: 'object',
      required: ['nome', 'cnpj'],
      properties: {
        nome: { type: 'string', minLength: 1 },
        cnpj: { type: 'string', minLength: 1 },
      },
    },
    validadores: {
      type: 'array',
      items: {
        type: 'object',
        required: ['codigo', 'ativo', 'parametros'],
        properties: {
          codigo: { type: 'string', minLength: 1, pattern: '\\S' },
          ativo: { type: 'boolean' },
          parametros: { type: 'object' },
        },
      },
    },
    precificacao: {
      type: 'object',
      required: ['metodo', 'taxa_mensal_percentual', 'base_dias'],
      properties: {
        metodo: { type: 'string', enum: ['DESCONTO_SIMPLES'] },
        taxa_mensal_percentual: { type: 'number', minimum: 0 },
        base_dias: { type: 'integer', minimum: 1 },
      },
    },
  },
} as const;

export async function validadoresRoutes(server: FastifyInstance) {
  server.get('/validadores', getValidadores);
  server.put<{ Body: ConfiguracaoValidadores }>('/validadores', {
    schema: { body: configuracaoSchema },
  }, setValidadores);
}
