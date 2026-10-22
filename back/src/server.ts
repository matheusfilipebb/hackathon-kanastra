import Fastify from 'fastify';

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
  await server.listen({
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
  });
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
