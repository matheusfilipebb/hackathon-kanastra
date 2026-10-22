import Fastify from 'fastify';
import { registerDocumentation } from './docs/swagger.js';
import { recebiveisRoutes } from './routes/recebiveis.routes.js';
import { validadoresRoutes } from './routes/validadores.routes.js';

const server = Fastify({ logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    try {
      await server.close();
    } catch (error) {
      server.log.error(error);
      process.exitCode = 1;
    }
  });
}

try {
  await registerDocumentation(server);
  await server.register(recebiveisRoutes);
  await server.register(validadoresRoutes);
  await server.listen({
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
  });
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
