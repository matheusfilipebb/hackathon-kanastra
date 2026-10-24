# Antecipe

Aplicação para analisar recebíveis e calcular a precificação sugerida para as notas aprovadas. O projeto contém um frontend em React/Vite e uma API em Node.js, TypeScript e Fastify.

## Requisitos

- Node.js 22 ou superior
- npm

Confira as versões instaladas:

```bash
node --version
npm --version
```

## Rodar a aplicação do zero

Clone o repositório e entre na pasta do projeto:

```bash
git clone <URL_DO_REPOSITORIO>
cd hackathon-kanastra
```

Instale as dependências do backend e do frontend, cada um em seu diretório:

```bash
cd back
npm ci
cd ../front
npm ci
```

Inicie a API em um terminal:

```bash
cd back
npm run dev
```

A API inicia por padrão em `http://localhost:3000`. Para mudar a porta, defina `PORT`; para mudar o endereço de escuta, defina `HOST` (padrão `0.0.0.0`).

Inicie o frontend em outro terminal, a partir da raiz do projeto:

```bash
cd front
```

O frontend usa `VITE_API_URL` para localizar a API. Configure-a para a URL da API que está executando localmente e inicie o Vite:

```bash
printf 'VITE_API_URL=http://localhost:3000\n' > .env.local
npm run dev
```

Abra no navegador o endereço mostrado pelo Vite (normalmente `http://localhost:5173`). Mantenha os dois processos em execução. Encerre cada um com `Ctrl+C`.

## Dados e configuração

- A configuração inicial dos validadores está em `back/data/validadores_antecipe.json`.
- A base local de situações cadastrais usada pela análise está em `back/data/cnpj_situacao_mock.csv`.
- Os arquivos de entrada CSV devem ter cabeçalho com as colunas esperadas pela API e ser separados por ponto e vírgula (`;`). O upload usa `multipart/form-data`, no campo `file`.
- O CORS da API aceita qualquer origem, permitindo a comunicação com o servidor Vite local.

As alterações feitas na configuração via `PUT /validadores` são salvas no arquivo JSON e persistem após reiniciar a API.

## API

Com a API iniciada, consulte e teste os endpoints pela documentação Swagger em [http://localhost:3000/docs](http://localhost:3000/docs). A especificação também está disponível em `/docs/json` e `/docs/yaml`.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/recebiveis/upload` | Analisa um CSV e retorna o resultado por nota; as notas aprovadas incluem precificação sugerida. |
| `GET` | `/validadores` | Consulta as regras e parâmetros de validação atuais. |
| `PUT` | `/validadores` | Valida e salva a configuração completa dos validadores. |

Veja os detalhes, formatos e exemplos em [docs/rotas.md](docs/rotas.md).

## Verificações e build

Para executar os testes do backend:

```bash
cd back
npm test
```

Para gerar a versão compilada do backend:

```bash
cd back
npm run build
npm start
```

Para compilar o frontend:

```bash
cd front
npm run build
```

## Estrutura do projeto

```text
back/       API, regras de análise, dados e prompts
front/      Interface web em React e Vite
docs/       Documentação de rotas e comparação com o resultado esperado
```
