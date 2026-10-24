# Verificação de segurança do backend — 24/10/2026

## Escopo e método

Revisão do código em `back/`, contratos HTTP, arquivos de dados, Docker e dependências do `package-lock.json`. Foram usados leitura de código, `npm audit --omit=dev --json` e testes em uma instância Fastify local, com repository substituído por memória. Nenhum PUT ou teste de carga foi executado no site público. Nenhuma configuração de produção foi alterada.

Esta revisão não é um teste de invasão completo. Não verifica as políticas efetivamente configuradas no Cloudflare Access, as permissões do host, imagens por CVE ou todos os formatos possíveis de segredos.

## Achados por prioridade

### 1. Crítico — alterações das regras sem autenticação ou autorização

**Referências:** [rotas dos validadores](../back/src/routes/validadores.routes.ts), [controller](../back/src/controllers/validadores.controller.ts), [servidor](../back/src/server.ts).

O backend não exige identidade ou permissão no `PUT /validadores`. Quem alcançar essa rota pode alterar taxa de desconto, parâmetros e regras ativas de todos os próximos uploads. A validação aceita `validadores: []`; logo, também permite eliminar todas as regras de elegibilidade.

**Evidência:** em `Fastify.inject`, um PUT sem qualquer credencial retornou 200 para uma configuração sem regras. A análise seguinte aprovou uma nota com documentos inválidos. A gravação do teste foi somente em memória.

**Impacto:** alteração persistente da lógica financeira e de elegibilidade. A exposição externa depende das proteções na frente da API: Cloudflare Tunnel, por si só, não implementa autorização. Uma política Cloudflare Access efetivamente aplicada a todos os caminhos pode restringir esse acesso, mas não foi auditada nesta revisão.

**Correção prioritária:** exigir autenticação no backend e autorização de administrador para alterar configuração. Se a aplicação for restrita, configurar também Cloudflare Access para o hostname inteiro. CORS não substitui autenticação; o `origin: '*'` atual permite chamadas de outros sites, mas restringir origens não impede chamadas por clientes HTTP.

### 2. Alto — possibilidade de esgotamento de recursos no upload

**Atualização:** implementados limites globais de frequência e concorrência no endpoint, configuráveis por ambiente, com resposta 429 e liberação das vagas em sucesso, erros e interrupções de recebimento. O Nginx passou a encaminhar o corpo sem buffering prévio. O texto abaixo descreve o achado original. Limites de linhas/campos e workers continuam como melhorias pendentes.

**Referências:** [controller de upload](../back/src/controllers/recebiveis.controller.ts), [parser](../back/src/utils/parse-recebiveis-csv.ts), [motor](../back/src/services/analise.service.ts), [concentração](../back/src/validators/coletivos/concentracao-maxima.validator.ts).

Há limite de 50 MiB por arquivo, mas não há limite de requisições por cliente, quantidade simultânea de análises ou número de notas por CSV. O arquivo é materializado em buffer, texto e objetos; os cálculos e a construção do resultado ocorrem no mesmo processo Node.js. Campos de tamanho arbitrário, inclusive valores convertidos em `BigInt`, também não têm um limite específico.

**Impacto:** uploads repetidos ou simultâneos podem aumentar memória, bloquear o processamento de outras requisições e tornar o serviço indisponível. Cancelar no navegador não cancela de forma coordenada um cálculo já iniciado. O limite por arquivo reduz a superfície, mas não limita o consumo agregado.

**Evidência:** fluxo confirmado por leitura do código. Não foi feito teste de esgotamento ou ataque de carga na produção.

**Correção:** controlar acesso e frequência, limitar análises concorrentes, estabelecer limites de linhas e tamanho de campos e considerar uma fila com workers para o cálculo. Ao limitar por IP atrás de proxy, configurar e validar quais proxies são confiáveis para não aceitar cabeçalhos forjados como identidade do cliente.

### 3. Alto — dependências de produção com avisos de segurança

**Atualização:** corrigido no código e lockfile. Fastify foi atualizado para `5.12.7`; Swagger UI para `6.1.2`, com `@fastify/static@10.1.7`; `tsx` para `4.23.15`, com `esbuild@0.28.2`. A auditoria completa e a de produção retornaram zero vulnerabilidades, e os 55 testes do backend passaram em Node 22. O texto abaixo preserva o resultado da auditoria inicial. Isso não significa ausência de falhas desconhecidas nem corrige os demais achados.

O `npm audit --omit=dev` retornou **3 pacotes afetados: 2 classificados como altos e 1 moderado**. Isso é contagem por pacote, não de três falhas independentes.

| Pacote instalado | Situação |
| --- | --- |
| `fastify@5.6.2` | Avisos de bypass de validação e negação de serviço, entre outros. |
| `@fastify/static@9.3.0` | Dependência transitiva do Swagger UI com avisos de bypass de proteção de rotas estáticas. |
| `@fastify/swagger-ui@5.2.6` | Afetado pela cadeia transitiva; o audit sugere migração para uma versão principal mais nova. |

Referências dos avisos: [bypass via Content-Type no Fastify](https://github.com/advisories/GHSA-jx2c-rxcm-jvmq), [rotas estáticas e URLs não canônicas](https://github.com/advisories/GHSA-8pvw-jcv7-9cmj) e [DoS em respostas HTTP/2](https://github.com/advisories/GHSA-4mh8-r7rc-xpvc).

A aplicabilidade depende do recurso: o Fastify deste projeto não está configurado como servidor HTTP/2 e a aplicação não retorna Web Streams; o HTTP/2 externo termina antes dele. Os avisos de arquivos estáticos não demonstram leitura arbitrária de arquivos fora do diretório servido. Já os avisos de validação merecem atenção porque o PUT depende de schemas para validar o corpo.

**Correção:** atualizar Fastify e a cadeia Swagger UI/static para versões corrigidas e compatíveis, revisar mudanças de versão principal, executar os testes e repetir o audit. Na revisão inicial não foi executado `npm audit fix --force`. A correção posterior atualizou explicitamente as dependências e o lockfile, sem usar esse comando.

### 4. Médio — configuração aceita pelo PUT pode interromper todas as análises

**Referências:** [validação da configuração](../back/src/services/validadores.service.ts), [schema](../back/src/routes/validadores.routes.ts), [início da execução](../back/src/services/analise.service.ts).

O service valida apenas parte dos parâmetros. Aceita, por exemplo, uma regra ativa de situação cadastral sem `situacoes_aceitas` e concentração de sacado com agrupamento diferente de `RAIZ_CNPJ`. O arquivo é salvo com sucesso; a inconsistência só é detectada ao iniciar o próximo upload.

Além disso, códigos não são limitados aos validadores implementados. O despacho usa um objeto comum e acessa `verificacoes[regra.codigo]` sem conferir propriedade própria ou tipo de função. Um código reservado como `__proto__`, aceito pelo PUT, provoca erro ao executar a análise.

**Evidência:** três configurações foram aceitas com HTTP 200 em instância isolada e provocaram erro na chamada seguinte de `analisarRecebiveis`: situação sem parâmetros, agrupamento inválido e código reservado. Nenhum arquivo real foi modificado.

**Impacto:** indisponibilidade persistente do upload até corrigir o JSON. A autenticação reduz quem pode provocar isso, mas não substitui a validação necessária para evitar erros de um administrador.

**Correção:** validar todos os parâmetros antes da gravação, restringir códigos aos implementados, validar os limites de domínio e usar `Map` ou checagem de propriedade própria no despacho. Isso não é evidência de poluição global de protótipo; o erro comprovado é no acesso a propriedades herdadas.

## Controles encontrados

- Imagem do backend executa como usuário `node`, sem privilégios de root.
- Porta do backend é publicada apenas em `127.0.0.1` no Compose.
- Arquivos `.env` são ignorados pelo Git e excluídos dos contextos Docker.
- Caminhos dos arquivos de dados são definidos no código; o nome do arquivo enviado não é usado como destino de gravação.
- CSV é interpretado sem executar seu conteúdo; não foram encontrados `eval`, comandos de shell ou consultas SQL construídas a partir dos dados do upload.
- Parser exige UTF-8 válido, cabeçalho conhecido e quantidade consistente de campos.
- JSON de configuração é gravado com arquivo temporário exclusivo e troca atômica. Isso evita gravação parcial, mas não evita sobrescrita entre duas edições concorrentes.
- Triagem limitada dos arquivos versionados por padrões de chave privada e chave AWS não encontrou correspondências. Isso não garante ausência de todo tipo de segredo.

## Ordem recomendada para correção

1. Proteger o PUT e o upload com controle de acesso antes de manter a API aberta na internet.
2. Atualizar dependências e executar testes de regressão.
3. Validar configurações integralmente antes de persistir e endurecer o despacho das regras.
4. Limitar frequência, concorrência, linhas e campos dos uploads.

A revisão inicial produziu este relatório sem alterar o backend ou a produção. Posteriormente, os limites de frequência e concorrência e as atualizações de dependências foram implementados no código, conforme as atualizações dos achados 2 e 3; a implantação deve ser feita separadamente.
