import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ConfiguracaoValidadores {
  fundo: { nome: string; cnpj: string };
  validadores: Array<{
    codigo: string;
    ativo: boolean;
    parametros: Record<string, unknown>;
  }>;
  precificacao: {
    metodo: 'DESCONTO_SIMPLES';
    taxa_mensal_percentual: number;
    base_dias: number;
  };
}

const configPath = fileURLToPath(
  new URL('../../data/validadores_antecipe.json', import.meta.url),
);

export async function getValidadores(_request: FastifyRequest, reply: FastifyReply) {
  const configuracao: ConfiguracaoValidadores = JSON.parse(await readFile(configPath, 'utf-8'));
  return reply.send(configuracao);
}

export async function setValidadores(
  request: FastifyRequest<{ Body: ConfiguracaoValidadores }>,
  reply: FastifyReply,
) {
  const codigos = request.body.validadores.map(validador => validador.codigo);
  if (new Set(codigos).size !== codigos.length) {
    return reply.code(400).send({ message: 'Não é permitido repetir o código de um validador.' });
  }

  // Substitui o arquivo inteiro somente depois que a gravação terminar.
  const tempPath = `${configPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(request.body, null, 2)}\n`, {
      encoding: 'utf-8', flag: 'wx',
    });
    await rename(tempPath, configPath);
  } finally {
    await rm(tempPath, { force: true });
  }

  return reply.send(request.body);
}
