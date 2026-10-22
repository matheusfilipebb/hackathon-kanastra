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

Encerre o servidor com `Ctrl+C`.

## Upload de CSV

`POST /recebiveis/upload` recebe um arquivo no campo `file` de um formulário `multipart/form-data` (limite de 50 MiB).

```bash
curl -X POST http://localhost:3000/recebiveis/upload \
  -F 'file=@../../estoque_antecipe.csv'
```

O controller interpreta o CSV em UTF-8, separado por `;`, com suporte a BOM, campos entre aspas, aspas escapadas e quebras de linha LF/CRLF. Verifica o cabeçalho e a quantidade de campos, mantendo os valores como strings.

Por enquanto, todo CSV válido retorna o conteúdo completo de `resultado_esperado_100k.json`, independentemente das notas enviadas. Ainda não há validação de elegibilidade. Mantenha esse JSON na pasta `antecipe`, ao lado de `hackathon-kanastra`, como nos arquivos fornecidos.

Arquivo ausente ou CSV inválido retorna `400`; conteúdo que não seja multipart retorna `415`; arquivo acima do limite retorna `413`.

## Configuração dos validadores

- `GET /validadores`: retorna a configuração atual, com `fundo`, `validadores` (ativos e inativos) e `precificacao`.
- `PUT /validadores`: substitui a configuração completa e retorna o JSON salvo. Envie o mesmo formato de `validadores_antecipe.json`, com `Content-Type: application/json`.

```bash
curl http://localhost:3000/validadores
curl -X PUT http://localhost:3000/validadores \
  -H 'Content-Type: application/json' \
  --data-binary @data/validadores_antecipe.json
```

O arquivo `data/validadores_antecipe.json`, dentro do backend, é lido a cada consulta e atualizado pelo PUT. As alterações persistem após reiniciar o servidor. O mesmo caminho é usado em desenvolvimento e na versão compilada.

O PUT valida a estrutura, os campos obrigatórios, a taxa não negativa, a base de dias positiva e códigos duplicados; payloads inválidos retornam `400`. Os parâmetros específicos de cada regra ainda não são validados. O upload continua retornando o gabarito fixo nesta etapa.

O histórico de prompts está em `prompt/`.
