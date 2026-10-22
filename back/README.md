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

## Documentação da API

Com o servidor iniciado, acesse [Swagger UI](http://localhost:3000/docs) para consultar e testar as rotas. A especificação OpenAPI está disponível em `/docs/json` e `/docs/yaml`.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/recebiveis/upload` | Envia um CSV no campo `file` e recebe o gabarito fixo. |
| GET | `/validadores` | Consulta a configuração atual. |
| PUT | `/validadores` | Valida e substitui a configuração completa. |

O Swagger inclui os formatos de requisição, exemplos, respostas de sucesso e erros `400`, `413`, `415` e `500`, conforme a rota. A operação PUT altera o arquivo de configuração também quando executada pela documentação.

## Upload de CSV

`POST /recebiveis/upload` recebe um arquivo no campo `file` de um formulário `multipart/form-data` (limite de 50 MiB).

```bash
curl -X POST http://localhost:3000/recebiveis/upload \
  -F 'file=@../../estoque_antecipe.csv'
```

O controller interpreta o CSV em UTF-8, separado por `;`, com suporte a BOM, campos entre aspas, aspas escapadas e quebras de linha LF/CRLF. Verifica o cabeçalho e a quantidade de campos, mantendo os valores como strings.

Por enquanto, todo CSV válido retorna o conteúdo completo de `data/resultado_esperado_100k.json`, independentemente das notas enviadas. Ainda não há validação de elegibilidade.

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

O controller delega ao service as validações e ao repository a leitura e gravação atômica de `data/validadores_antecipe.json`. O PUT rejeita configurações inválidas com `400`, sem alterar o arquivo:

- `VALOR_MINIMO.valor_minimo` e os percentuais devem ser números finitos maiores ou iguais a zero.
- `PRAZO_MINIMO.prazo_minimo_dias` e `PRAZO_MAXIMO.prazo_maximo_dias` devem ser inteiros maiores ou iguais a zero.
- `TIPO_RECEBIVEL.tipos_aceitos` deve ser uma lista não vazia contendo apenas `Duplicata`, `Duplicata de Serviço`, `Cheque`, `CCB` ou `Nota Comercial`.
- A taxa de precificação não pode ser negativa e `base_dias` deve ser um inteiro positivo.
- Códigos de validadores não podem se repetir. Os parâmetros são validados também nas regras inativas.

O upload continua retornando o gabarito fixo nesta etapa. Execute os testes com `npm test`.

O histórico de prompts está em `prompt/`.
