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

Consulte o [guia das rotas em Markdown](../docs/rotas.md) para exemplos de requisição, resposta e erros.

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

## Motor de análise

`AnaliseService.validarCnpjSacado(documento)` retorna um booleano para a regra individual `CNPJ_SACADO_VALIDO`. Aceita CNPJ numérico como string de 14 dígitos ou com máscara `00.000.000/0000-00`, preservando zeros à esquerda. Confere os dois dígitos verificadores pelo módulo 11 e rejeita sequências de dígitos repetidos e formatos inválidos. A validação é local, sem APIs e sem consulta à situação cadastral.

O método está disponível no service; o upload continua retornando o gabarito fixo nesta etapa.

Para a regra `SITUACAO_CADASTRAL_SACADO`, chame `await analiseService.iniciarExecucao()` uma vez antes de percorrer as notas. O repository carrega `data/cnpj_situacao_mock.csv` (colunas `DOC;SITUACAO_CADASTRAL`) em um mapa em memória. Use `execucao.validarSituacaoCadastralSacado(docSacado)` em cada nota: a consulta não lê arquivos nem faz chamadas externas.

A regra usa `situacoes_aceitas` da configuração; CNPJ ausente no cadastro ou com situação não aceita retorna `false`. Quando a regra está inativa ou ausente, retorna `true` e não carrega o CSV. Uma nova execução recarrega configuração e cadastro, preservando o retrato usado pela execução anterior.

Na mesma execução, `execucao.validarTipoRecebivel(tipo)` verifica se o valor de `TIPO_RECEBIVEL` está na lista `parametros.tipos_aceitos` da regra ativa. A comparação é exata. A configuração inicial aceita `Duplicata` e `Duplicata de Serviço`; outros tipos só passam se incluídos na configuração. A lista é capturada uma vez por execução e a regra inativa ou ausente não barra a nota pelo tipo.

Também estão disponíveis na execução:

| Método | Critério quando a regra está ativa |
| --- | --- |
| `validarValorMinimo(valorNominal)` | Valor maior ou igual a `valor_minimo`. Aceita número ou string no padrão do CSV, como `100,00`. |
| `validarNaoVencida(vencimento, referencia)` | Vencimento na data de referência ou depois dela. |
| `validarPrazoMaximo(vencimento, referencia)` | Diferença em dias menor ou igual a `prazo_maximo_dias`. |
| `validarPrazoMinimo(vencimento, referencia)` | Diferença em dias maior ou igual a `prazo_minimo_dias`. |

Datas devem ser strings `dd/mm/aaaa` válidas. A referência é obrigatória na chamada: use a data da análise ou a aquisição para uma análise histórica, conforme o contexto desejado. Os cálculos usam dias civis em UTC para evitar diferenças de horário de verão. Vencimentos anteriores à referência são rejeitados por `NAO_VENCIDA`; `PRAZO_MAXIMO` verifica apenas o limite superior.

Todos os limites são inclusivos, vêm da configuração e ficam fixos durante cada execução. Regras inativas ou ausentes retornam `true`. Dados inválidos retornam `false` quando a regra está ativa, e limites configurados inválidos impedem iniciar a execução. O upload permanece com a resposta de gabarito fixo.

O histórico de prompts está em `prompt/`.

## Agrupamento para análise coletiva

`analiseService.agruparPorFundo(recebiveis)` retorna um `Map`, com o valor de `DOC_FUNDO` como chave e a lista de notas do fundo como valor. Passe as notas na ordem do CSV: essa ordem é mantida dentro de cada grupo e os fundos aparecem na ordem de sua primeira ocorrência. O agrupamento preserva os objetos e todos os campos, sem alterar a entrada nem remover notas repetidas. Nesta etapa, ainda não calcula concentração.
