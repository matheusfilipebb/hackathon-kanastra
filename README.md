# Antecipe

Acesse a aplicação: [antecipe.alvtn.site](https://antecipe.alvtn.site/).

Aplicação para analisar recebíveis e calcular a precificação sugerida para as notas aprovadas. O projeto contém um frontend em React/Vite e uma API em Node.js, TypeScript e Fastify.

## Como rodar

Escolha uma das opções:

- **Com Docker Compose:** inicia front e back juntos. Requer Docker Engine e o plugin Compose; não precisa instalar Node.js na máquina.
- **Com npm:** para desenvolvimento local. Requer Node.js 22 ou superior e npm.
- **Com Cloudflare Tunnel:** usa Docker Compose e adiciona o acesso pela internet com domínio e token da Cloudflare.

Se precisar instalar Docker, siga o guia para [Debian](https://docs.docker.com/engine/install/debian/) ou [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Confira com `docker --version` e `docker compose version`. Se seu usuário não tiver permissão para executar Docker, use `sudo` antes dos comandos `docker compose` abaixo.

## Rodar a aplicação do zero com npm

Clone o repositório e entre na pasta do projeto:

```bash
git clone https://github.com/matheusfilipebb/hackathon-kanastra.git
cd hackathon-kanastra
```

Na primeira configuração, copie os exemplos e instale as dependências. Execute a partir da raiz do projeto:

```bash
cp back/.env.example back/.env
cp front/.env.example front/.env
npm ci --prefix back
npm ci --prefix front
```

Se os arquivos `.env` já existirem, mantenha suas configurações em vez de sobrescrevê-los.

Inicie a API em um terminal, a partir da raiz:

```bash
npm run dev --prefix back
```

A API inicia em `http://localhost:3000`. Para mudar a porta ou o endereço de escuta, edite `PORT` e `HOST` em `back/.env`.

Em outro terminal, também a partir da raiz:

```bash
npm run dev --prefix front
```

O `front/.env` usa `VITE_API_URL=http://localhost:3000`. Se mudar a porta da API, ajuste esse endereço também.

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`. Mantenha os dois terminais abertos e use `Ctrl+C` para encerrar.

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

Execute os comandos a partir da raiz do projeto.

Testes do backend:

```bash
npm test --prefix back
```

Compilar e iniciar o backend:

```bash
npm run build --prefix back
npm start --prefix back
```

Conferir e compilar o frontend:

```bash
npm run lint --prefix front
npm run build --prefix front
```

## Estrutura do projeto

```text
back/       API, regras de análise e dados
front/      Interface web em React e Vite
docs/       Documentação de rotas e comparação com o resultado esperado
```

## Rodar do zero com Docker Compose

Essa opção sobe o front e o back juntos. Você precisa de Git, Docker Engine e Docker Compose instalados. Não precisa instalar Node.js ou npm na máquina.

1. Confira se os comandos estão disponíveis:

   ```bash
   git --version
   docker --version
   docker compose version
   ```

   Se o Docker não estiver instalado, use o guia para [Debian](https://docs.docker.com/engine/install/debian/) ou [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Se aparecer erro de permissão no Docker, execute os comandos `docker compose` com `sudo`.

2. Clone o projeto em uma pasta onde seu usuário tenha permissão:

   ```bash
   cd ~
   git clone https://github.com/matheusfilipebb/hackathon-kanastra.git
   cd hackathon-kanastra
   ```

3. Crie o arquivo de configuração:

   ```bash
   cp .env.example .env
   ```

   Os valores do exemplo já funcionam para rodar localmente. Se o `.env` já existir, mantenha suas configurações. Não é necessário criar os `.env` do front e do back nem preencher o token da Cloudflare para essa opção.

4. Construa e inicie a aplicação:

   ```bash
   docker compose up -d --build --wait
   ```

   Na primeira execução, o Docker baixa as imagens, instala as dependências e compila o projeto. Aguarde o comando terminar.

5. Confira os serviços:

   ```bash
   docker compose ps
   ```

   Os serviços `front` e `back` devem aparecer em execução e saudáveis (`healthy`).

6. Abra no navegador da máquina onde o Docker está rodando:

   - Aplicação: [http://localhost:8080](http://localhost:8080)
   - Documentação da API: [http://localhost:3000/docs](http://localhost:3000/docs)

   Envie um CSV no formato esperado para iniciar a análise.

Para acessar de outro computador na mesma rede, altere `FRONT_HOST=0.0.0.0` no `.env`, execute novamente `docker compose up -d` e abra `http://IP_DA_MAQUINA:8080`. A porta 8080 precisa estar liberada no firewall. Para acesso pela internet, siga a opção com Cloudflare Tunnel abaixo.

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
| `.env` | `FRONT_PORT=8080`, `BACK_PORT=3000`, `FRONT_HOST=127.0.0.1` | Portas e endereço publicados pelo Docker Compose. |
| `.env` | `CLOUDFLARE_TUNNEL_TOKEN` | Token necessário apenas para iniciar com Cloudflare Tunnel. |
| `front/.env` | `VITE_API_URL=http://localhost:3000` | Endereço da API usado pelo Vite no desenvolvimento local. |
| `back/.env` | `HOST=0.0.0.0`, `PORT=3000` | Endereço e porta usados por `npm run dev` e `npm start` no backend (Node.js 22+). |

No Docker, a API continua na porta interna 3000 e o frontend usa `/api` via Nginx; alterar `BACK_PORT` muda apenas a porta publicada na máquina. Os `.env` de `front` e `back` não entram nas imagens. No modo local, se alterar `PORT` em `back/.env`, ajuste também `VITE_API_URL` em `front/.env`. Reinicie os servidores após editar as variáveis. Se já existir `front/.env.local`, ele tem prioridade sobre `front/.env`.


## Opção: publicar com Cloudflare Tunnel

O arquivo `compose.tunnel.yaml` adiciona um conector `cloudflared` à rede da aplicação. O modo local continua funcionando com apenas `compose.yaml`.

Antes de seguir, clone o projeto e crie o `.env` da raiz conforme a opção Docker acima.

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
