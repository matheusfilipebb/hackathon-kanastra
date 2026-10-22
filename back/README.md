# Backend Antecipe

Servidor básico em Node.js, TypeScript e Fastify. Requer Node.js 22 ou superior.

```bash
cd hackathon-kanastra/back
npm install
npm run dev
```

O servidor escuta na porta `3000`. As variáveis de ambiente `PORT` e `HOST` permitem alterar a porta e o endereço de escuta (padrão: `0.0.0.0`).

Para compilar e executar:

```bash
npm run build
npm start
```

Esta etapa inicializa apenas o servidor, sem rotas ou regras de negócio. Requisições recebem a resposta padrão 404 do Fastify. Encerre com `Ctrl+C`.

O histórico de prompts está em `prompt/`.
