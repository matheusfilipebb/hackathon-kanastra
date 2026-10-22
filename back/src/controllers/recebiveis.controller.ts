import type { FastifyReply, FastifyRequest } from 'fastify';
import { AnaliseService } from '../services/analise.service.js';
import { parseRecebiveisCsv } from '../utils/parse-recebiveis-csv.js';
import type { RecebivelCsv } from '../types/recebivel-csv.js';

const service = new AnaliseService();

export async function uploadRecebiveis(request: FastifyRequest, reply: FastifyReply) {
  if (!request.isMultipart()) {
    return reply.code(415).send({ message: 'Envie o CSV como multipart/form-data no campo file.' });
  }

  const file = await request.file();
  if (!file) {
    return reply.code(400).send({ message: 'Envie um arquivo CSV no campo file.' });
  }
  const buffer = await file.toBuffer();
  if (file.fieldname !== 'file') {
    return reply.code(400).send({ message: 'O arquivo CSV deve ser enviado no campo file.' });
  }

  let recebiveis: RecebivelCsv[];
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    recebiveis = parseRecebiveisCsv(content);
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof TypeError
        ? 'O arquivo CSV deve usar codificação UTF-8.'
        : error instanceof Error ? error.message : 'CSV inválido.',
    });
  }

  const resultado = await service.analisarRecebiveis(recebiveis);
  return reply.send(resultado);
}
