# Rotas da API Antecipe

URL local padrão: `http://localhost:3000`. A porta pode ser alterada pela variável `PORT`.

CORS está habilitado para qualquer origem (`Access-Control-Allow-Origin: *`), com os métodos `GET`, `POST`, `PUT` e `OPTIONS`. O servidor responde às requisições preflight e permite os cabeçalhos solicitados pelo cliente. Credenciais CORS não estão habilitadas.

Para iniciar, execute na raiz do repositório:

```bash
cd back
npm install
npm run dev
```

Os exemplos de comandos abaixo consideram o terminal dentro de `back/`.

## Resumo

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST | `/recebiveis/upload` | Receber o CSV e calcular a classificação de cada nota. |
| GET | `/health` | Verificar a disponibilidade da API. |
| GET | `/validadores` | Consultar a configuração atual. |
| PUT | `/validadores` | Validar e substituir a configuração completa. |
| GET | `/docs` | Abrir a documentação interativa Swagger. |
| GET | `/docs/json` | Obter a especificação OpenAPI em JSON. |
| GET | `/docs/yaml` | Obter a especificação OpenAPI em YAML. |

## GET /health

Confirma que o processo da API está em execução e responde a requisições. Retorna HTTP `200`, `Cache-Control: no-store` e o corpo:

```json
{ "status": "ok" }
```

```bash
curl http://localhost:3000/health
```

O frontend usa somente essa rota para o indicador de disponibilidade: consulta ao abrir a página e novamente 10 segundos após cada verificação. A API é considerada disponível apenas com HTTP 2xx e `status: "ok"`. Erro HTTP, falha de rede, resposta inválida ou timeout de 5 segundos marcam o sistema como indisponível. A recuperação é detectada pela consulta seguinte, sem recarregar a página.

Essa verificação não lê os validadores e não executa análise de recebíveis. O Compose usa a mesma rota no healthcheck do backend.

## POST /recebiveis/upload

Envie um formulário `multipart/form-data` com um arquivo no campo `file`. O limite por arquivo é de **50 MiB**.

O CSV deve estar em UTF-8, separado por `;`, com valores decimais usando vírgula e datas `dd/mm/aaaa`. São aceitos BOM, quebras LF/CRLF, campos entre aspas e aspas escapadas. O cabeçalho deve conter estas 11 colunas, sem colunas adicionais:

```csv
NOME_FUNDO;DOC_FUNDO;NOME_CEDENTE;DOC_CEDENTE;NOME_SACADO;DOC_SACADO;NU_DOCUMENTO;TIPO_RECEBIVEL;VALOR_NOMINAL;DATA_VENCIMENTO_ORIGINAL;DATA_AQUISICAO
```

```bash
curl http://localhost:3000/recebiveis/upload \
  -F 'file=@../../estoque_antecipe.csv'
```

No navegador, use `FormData` para enviar o arquivo. O cliente define o `Content-Type` com o boundary automaticamente.

```javascript
const form = new FormData();
form.append('file', arquivoCsv);
const response = await fetch('http://localhost:3000/recebiveis/upload', {
  method: 'POST',
  body: form,
});
const resultado = await response.json();
```

### Resposta 200

Retorna um resultado para cada nota enviada, preservando a ordem do CSV. Exemplo de formato:

```json
[
  {
    "linha": 2,
    "id": "000123",
    "status": "APROVADO",
    "precificacao": {
      "metodo": "DESCONTO_SIMPLES",
      "taxa_mensal_percentual": 2,
      "base_dias": 30,
      "prazo_dias": 60,
      "valor_nominal": 1000,
      "valor_desconto": 40,
      "valor_liquido": 960
    }
  },
  {
    "linha": 3,
    "id": "1-759172",
    "status": "BARRADO",
    "barrado_por": ["CONCENTRACAO_MAXIMA_SACADO"]
  }
]
```

| Campo | Significado |
| --- | --- |
| `linha` | Linha física original do CSV enviado; o cabeçalho ocupa a linha 1. |
| `id` | Número da nota (`NU_DOCUMENTO`), como string. Não é um identificador global único. |
| `status` | `APROVADO` ou `BARRADO`. |
| `barrado_por` | Lista dos códigos de recusa, presente nas notas barradas. |
| `precificacao` | Cotação sugerida, presente somente nas notas aprovadas após todas as regras. |

**Comportamento atual:** o controller faz o parser e delega ao motor. As regras individuais ativas acumulam todos os motivos de recusa; depois, as regras de concentração trabalham apenas sobre notas ainda aprovadas e são reavaliadas até não ocorrerem novas recusas. A referência para vencimento e prazo é `DATA_AQUISICAO` de cada nota, para análise histórica do estoque. As notas do lote são a base de cálculo de cada fundo; o backend ainda não adiciona um estoque externo. O endpoint não lê o gabarito. Depois das regras coletivas, as notas ainda aprovadas recebem a precificação sugerida.

### Precificação das aprovadas

O método atual é `DESCONTO_SIMPLES`, com taxa e base lidas de `precificacao` na configuração. A mesma configuração é usada na análise e na cotação da requisição inteira.

```text
prazo_dias = DATA_VENCIMENTO_ORIGINAL - DATA_AQUISICAO
desconto = valor_nominal × (taxa_mensal_percentual / 100) × (prazo_dias / base_dias)
valor_liquido = valor_nominal - desconto
```

Os valores monetários são retornados como números em reais. O cálculo interno usa centavos inteiros e a taxa como fração; o desconto é arredondado uma única vez para o centavo mais próximo, com meio centavo arredondado para cima. O líquido é o nominal menos o desconto arredondado. Um título de R$ 1.000 por 60 dias, a 2% com base de 30 dias, tem desconto de R$ 40 e líquido de R$ 960.

Notas barradas não têm o campo `precificacao`. Datas inválidas, vencimento anterior à aquisição, método não suportado ou parâmetros que gerem desconto superior ao valor nominal impedem uma cotação válida e retornam `422`, sem apresentar um valor líquido negativo.

### Erros

| Status | Causa |
| --- | --- |
| 400 | Arquivo ausente, campo diferente de `file`, CSV vazio, cabeçalho incorreto, campos inconsistentes, aspas inválidas ou codificação inválida. |
| 413 | Arquivo maior que 50 MiB. |
| 415 | Requisição sem `multipart/form-data`. |
| 422 | Não foi possível calcular uma precificação válida para uma nota aprovada ou a configuração de preços é inválida. |
| 500 | Falha interna, como erro ao ler a configuração ou o cadastro de situações. |

Exemplo de erro retornado pelo controller:

```json
{ "message": "Envie um arquivo CSV no campo file." }
```

## GET /validadores

Retorna a configuração atual de `back/data/validadores_antecipe.json`. Inclui fundo, regras ativas e inativas e parâmetros de precificação. O arquivo é lido a cada consulta.

```bash
curl http://localhost:3000/validadores
```

### Resposta 200 e formato da configuração

Este também é o formato esperado pelo PUT:

```json
{
  "fundo": {
    "nome": "ANTECIPE FIDC",
    "cnpj": "92.234.400/0001-80"
  },
  "validadores": [
    { "codigo": "CNPJ_SACADO_VALIDO", "ativo": true, "parametros": {} },
    { "codigo": "SITUACAO_CADASTRAL_SACADO", "ativo": true, "parametros": { "situacoes_aceitas": ["ATIVA"] } },
    { "codigo": "TIPO_RECEBIVEL", "ativo": true, "parametros": { "tipos_aceitos": ["Duplicata", "Duplicata de Serviço"] } },
    { "codigo": "VALOR_MINIMO", "ativo": true, "parametros": { "valor_minimo": 100 } },
    { "codigo": "NAO_VENCIDA", "ativo": true, "parametros": {} },
    { "codigo": "PRAZO_MAXIMO", "ativo": true, "parametros": { "prazo_maximo_dias": 180 } },
    { "codigo": "CONCENTRACAO_MAXIMA_SACADO", "ativo": true, "parametros": { "percentual_maximo": 10, "agrupamento": "RAIZ_CNPJ" } },
    { "codigo": "PRAZO_MINIMO", "ativo": false, "parametros": { "prazo_minimo_dias": 30 } },
    { "codigo": "CONCENTRACAO_MAXIMA_CEDENTE", "ativo": false, "parametros": { "percentual_maximo": 8 } }
  ],
  "precificacao": {
    "metodo": "DESCONTO_SIMPLES",
    "taxa_mensal_percentual": 2,
    "base_dias": 30
  }
}
```

Erros de leitura ou JSON inválido no arquivo retornam `500`.

## PUT /validadores

Recebe `Content-Type: application/json` e o objeto completo descrito acima. **Substitui toda a configuração**, incluindo a lista de validadores. Para alterar apenas uma regra, consulte a configuração, modifique o campo desejado e envie o objeto completo.

```bash
curl -X PUT http://localhost:3000/validadores \
  -H 'Content-Type: application/json' \
  --data-binary @data/validadores_antecipe.json
```

### Validações do PUT

| Campo ou regra | Restrição |
| --- | --- |
| Estrutura | `fundo`, `validadores` e `precificacao` são obrigatórios. |
| Validador | Exige `codigo`, `ativo` e `parametros`; códigos não podem se repetir. |
| `VALOR_MINIMO.valor_minimo` | Número finito maior ou igual a zero. |
| `TIPO_RECEBIVEL.tipos_aceitos` | Lista não vazia contendo apenas `Duplicata`, `Duplicata de Serviço`, `Cheque`, `CCB` ou `Nota Comercial`. |
| `PRAZO_MAXIMO.prazo_maximo_dias` | Inteiro maior ou igual a zero. |
| `PRAZO_MINIMO.prazo_minimo_dias` | Inteiro maior ou igual a zero. |
| Concentração de sacado ou cedente | `percentual_maximo` deve ser um número finito maior ou igual a zero. |
| `precificacao.metodo` | `DESCONTO_SIMPLES`. |
| `precificacao.taxa_mensal_percentual` | Número finito maior ou igual a zero. |
| `precificacao.base_dias` | Inteiro maior que zero. |

As verificações de parâmetros do PUT também se aplicam às regras inativas. Os demais parâmetros ainda não têm validação específica no service de configuração.

### Respostas

| Status | Resultado |
| --- | --- |
| 200 | Configuração salva; o corpo contém o objeto completo atualizado. |
| 400 | JSON malformado, estrutura inválida, código duplicado ou parâmetro inválido. |
| 415 | Tipo de conteúdo não suportado. |
| 500 | Falha ao persistir o arquivo. |

Exemplo de erro de parâmetro:

```json
{ "message": "VALOR_MINIMO.valor_minimo deve ser um número maior ou igual a zero." }
```

A configuração só é gravada depois das validações. O repository escreve em um arquivo temporário e faz a substituição atômica de `data/validadores_antecipe.json`. Requisições rejeitadas por validação preservam o arquivo anterior. As alterações persistem após reiniciar o servidor.

Erros gerados pelo Fastify podem incluir, além de `message`, os campos `statusCode`, `error` e `code`. A atualização é aplicada na próxima requisição de upload. O gabarito é usado apenas pelo script de comparação, nunca para produzir a resposta HTTP.

## Swagger e OpenAPI

Acesse `/docs` para visualizar os contratos e testar as requisições. O PUT executado pelo Swagger também salva as alterações no arquivo de configuração.

A especificação pode ser exportada por `/docs/json` ou `/docs/yaml`. Para instruções de execução e detalhes do motor de análise, consulte o [README do backend](../back/README.md).
