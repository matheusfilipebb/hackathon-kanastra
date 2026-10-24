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
cp .env.example .env
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
back/       API, regras de análise e dados
front/      Interface web em React e Vite
docs/       Documentação de rotas e comparação com o resultado esperado
```

## Opção: executar com Docker Compose

Requer Docker com o plugin Compose. Na raiz do repositório:

```bash
docker compose up -d --build
```

- Frontend: http://localhost:8080
- API e Swagger (na máquina onde o Docker está rodando): http://localhost:3000/docs

O frontend usa `/api` e o Nginx encaminha as chamadas ao backend pela rede do Compose. Isso permite acessar a aplicação pelo endereço do servidor sem configurar o IP da API no navegador e evita CORS entre front e back. O frontend é compilado para produção; alterações no código exigem reconstruir as imagens.

Para usar outras portas, sem alterar arquivos:

```bash
FRONT_PORT=8081 BACK_PORT=3001 docker compose up -d --build
```

Para consultar logs e parar os serviços:

```bash
docker compose logs -f
docker compose down
```

Os dados de `back/data` são copiados para o volume `backend_data` na primeira execução. As alterações de validadores feitas pela interface persistem após reiniciar, reconstruir as imagens ou executar `docker compose down`. Depois da primeira execução, atualizar os arquivos de `back/data` no repositório não substitui o conteúdo do volume existente.

`docker compose down -v` apaga o volume e as configurações salvas; na próxima inicialização, os dados serão novamente carregados da imagem.

O modo local com `npm ci` e `npm run dev` continua disponível conforme as instruções anteriores.


## Arquivos de ambiente

Os arquivos `.env` locais não são versionados. Para configurá-los após clonar:

```bash
cp .env.example .env
cp front/.env.example front/.env
cp back/.env.example back/.env
```

| Arquivo | Variáveis | Uso |
| --- | --- | --- |
| `.env` | `FRONT_PORT=8080`, `BACK_PORT=3000` | Portas publicadas pelo Docker Compose. |
| `front/.env` | `VITE_API_URL=http://localhost:3000` | Endereço da API usado pelo Vite no desenvolvimento local. |
| `back/.env` | `HOST=0.0.0.0`, `PORT=3000` | Endereço e porta usados por `npm run dev` e `npm start` no backend (Node.js 22+). |

No Docker, a API continua na porta interna 3000 e o frontend usa `/api` via Nginx; alterar `BACK_PORT` muda apenas a porta publicada na máquina. Os `.env` de `front` e `back` não entram nas imagens. No modo local, se alterar `PORT` em `back/.env`, ajuste também `VITE_API_URL` em `front/.env`. Reinicie os servidores após editar as variáveis. Se já existir `front/.env.local`, ele tem prioridade sobre `front/.env`.


## Opção: publicar com Cloudflare Tunnel

O arquivo `compose.tunnel.yaml` adiciona um conector `cloudflared` à rede da aplicação. O modo local continua funcionando com apenas `compose.yaml`.

1. No painel Cloudflare, crie um túnel do tipo **Cloudflared**, gerenciado remotamente, e copie o token mostrado na opção Docker.
2. No `.env` da raiz, configure:

   ```dotenv
   CLOUDFLARE_TUNNEL_TOKEN=cole_seu_token_aqui
   FRONT_HOST=127.0.0.1
   ```

   O token fica somente no backend do conector e não é enviado ao navegador. Não versione o `.env` nem compartilhe a saída de `docker compose config`, que pode conter o token interpolado.

3. Configure no túnel uma rota de aplicação publicada para seu domínio/subdomínio, com serviço do tipo **HTTP** e URL **`front:80`** (equivalente a `http://front:80`). O conector roda dentro do Docker: `localhost:8080` não é o endereço do frontend nesse container.
4. Inicie na raiz do projeto:

   ```bash
   docker compose -f compose.yaml -f compose.tunnel.yaml up -d --build
   ```

5. Acesse `https://seu-subdominio.seu-dominio.com`. O mesmo endereço atende o frontend e `/api`; não altere `VITE_API_URL` para seu domínio, pois a imagem já usa `/api`.

O túnel estabelece conexões de saída; não é necessário abrir portas no roteador. Com `FRONT_HOST=127.0.0.1`, o frontend continua acessível em `http://localhost:8080` na máquina e pelo túnel. O backend permanece publicado somente em localhost.

A aplicação permite alterar validadores sem autenticação própria. Para restringir quem pode acessá-la, configure uma aplicação Cloudflare Access para o hostname publicado, incluindo os caminhos `/api/*`.

Para consultar o conector ou encerrar a execução:

```bash
docker compose -f compose.yaml -f compose.tunnel.yaml logs -f cloudflared
docker compose -f compose.yaml -f compose.tunnel.yaml down
```

Para atualizar o conector:

```bash
docker compose -f compose.yaml -f compose.tunnel.yaml pull cloudflared
docker compose -f compose.yaml -f compose.tunnel.yaml up -d
```

Se o domínio responder com erro 502, confira se a rota aponta para `http://front:80` e se os serviços estão saudáveis com `docker compose -f compose.yaml -f compose.tunnel.yaml ps`. O token precisa estar preenchido para executar os comandos que incluem o arquivo do túnel.

Documentação oficial: [configurar Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/) e [parâmetros do conector](https://developers.cloudflare.com/tunnel/reference/run-parameters/).


## Histórico de prompts

Os pedidos usados durante o projeto estão reunidos em [HISTORICO_PROMPTS.md](HISTORICO_PROMPTS.md), incluindo público-alvo, identidade visual, backend, Docker e Cloudflare Tunnel.
