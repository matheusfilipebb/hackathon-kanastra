import compress from '@fastify/compress';
import type { FastifyInstance } from 'fastify';

export async function registerResponseCompression(server: FastifyInstance) {
  await server.register(compress, {
    global: true,
    globalDecompression: false,
    threshold: 1024,
    encodings: ['gzip'],
    zlibOptions: { level: 4 },
  });
}
