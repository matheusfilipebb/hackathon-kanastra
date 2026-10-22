import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { uploadRecebiveis } from '../controllers/recebiveis.controller.js';

export async function recebiveisRoutes(server: FastifyInstance) {
  await server.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024 },
  });

  server.post('/recebiveis/upload', uploadRecebiveis);
}
