import type { FastifyInstance } from 'fastify';
import { errorSchema } from '../docs/schemas.js';
import {
  getValidadores, setValidadores,
} from '../controllers/validadores.controller.js';
import { codigosValidadores } from '../services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

const configuracaoSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['fundo', 'validadores', 'precificacao'],
  properties: {
    fundo: {
      type: 'object',
      additionalProperties: true,
      required: ['nome', 'cnpj'],
      properties: {
        nome: { type: 'string', minLength: 1 },
        cnpj: { type: 'string', minLength: 1 },
      },
    },
    validadores: {
      type: 'array',
      maxItems: codigosValidadores.length,
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['codigo', 'ativo', 'parametros'],
        properties: {
          codigo: { type: 'string', enum: codigosValidadores, description: 'Código da regra, único na configuração.' },
          ativo: { type: 'boolean', description: 'Indica se a regra está ativa.' },
          parametros: {
            type: 'object', additionalProperties: true,
            description: 'Parâmetros da regra: valor_minimo e percentual_maximo não negativos; '
              + 'percentual_maximo até 100; prazos inteiros seguros não negativos; agrupamento do sacado RAIZ_CNPJ; '
              + 'situacoes_aceitas não vazia; listas sem duplicações; tipos_aceitos deve conter apenas '
              + 'Duplicata, Duplicata de Serviço, Cheque, CCB ou Nota Comercial.',
          },
        },
      },
    },
    precificacao: {
      type: 'object',
      additionalProperties: true,
      required: ['metodo', 'taxa_mensal_percentual', 'base_dias'],
      properties: {
        metodo: { type: 'string', enum: ['DESCONTO_SIMPLES'] },
        taxa_mensal_percentual: { type: 'number', minimum: 0 },
        base_dias: { type: 'integer', minimum: 1 },
      },
    },
  },
  examples: [{
    fundo: { nome: 'ANTECIPE FIDC', cnpj: '92.234.400/0001-80' },
    validadores: [
      { codigo: 'VALOR_MINIMO', ativo: true, parametros: { valor_minimo: 100 } },
      { codigo: 'TIPO_RECEBIVEL', ativo: true, parametros: { tipos_aceitos: ['Duplicata', 'Duplicata de Serviço'] } },
    ],
    precificacao: { metodo: 'DESCONTO_SIMPLES', taxa_mensal_percentual: 2, base_dias: 30 },
  }],
} as const;

export async function validadoresRoutes(server: FastifyInstance) {
  server.get('/validadores', {
    schema: {
      tags: ['Validadores'],
      summary: 'Consultar os validadores configurados',
      description: 'Lê data/validadores_antecipe.json e retorna fundo, regras ativas e inativas e precificação.',
      response: { 200: configuracaoSchema, 500: errorSchema },
    },
  }, getValidadores);
  server.put<{ Body: ConfiguracaoValidadores }>('/validadores', {
    schema: {
      tags: ['Validadores'],
      summary: 'Atualizar a configuração dos validadores',
      description: 'Substitui a configuração completa em data/validadores_antecipe.json. '
        + 'Valida também regras inativas. Em caso de erro de validação, o arquivo anterior é preservado. '
        + 'Envie todos os campos; este endpoint não faz atualização parcial.',
      body: configuracaoSchema,
      response: { 200: configuracaoSchema, 400: errorSchema, 415: errorSchema, 500: errorSchema },
    },
  }, setValidadores);
}
