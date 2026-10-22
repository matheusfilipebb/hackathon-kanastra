import type { FastifyReply, FastifyRequest } from 'fastify';
import { ValidadoresService, ValidadoresValidationError } from '../services/validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

const service = new ValidadoresService();

export async function getValidadores(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await service.get());
}

export async function setValidadores(
  request: FastifyRequest<{ Body: ConfiguracaoValidadores }>,
  reply: FastifyReply,
) {
  try {
    return reply.send(await service.set(request.body));
  } catch (error) {
    if (error instanceof ValidadoresValidationError) {
      return reply.code(400).send({ message: error.message });
    }
    throw error;
  }
}
