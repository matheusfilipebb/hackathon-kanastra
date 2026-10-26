# REA aplicado ao Antecipe

A análise da página pública da Kanastra foi copiada para este projeto e usada para atualizar o frontend em 25/10/2026.

## Evidências da referência

- [Registro da primeira execução](execucao-inicial.md).
- [Bundle exportado pelo REA](kanastra-evidencias.json): registros completos, parâmetros e limites da observação.
- [Captura visual da Kanastra](kanastra-desktop.png), em 1440 × 1000.

A captura visual complementar tem o ID `ev_7fc368990e5acc4b855047c02f83cb9ddb5870eaae9fc310df61498a627a0ab7`. O REA abriu o Chrome, navegou para `https://www.kanastra.com.br/`, aguardou 1800 ms e capturou screenshot, DOM e acessibilidade. A captura foi declarada completa dentro dessa janela.

Observado: fundo claro em tom creme, área principal escura com cantos arredondados, navegação integrada à área principal e conteúdo organizado por serviços. O DOM referencia Inter e VinilaExtended-Light; essa referência isolada não comprova a fonte efetivamente renderizada.

## Aplicação ao frontend

O Antecipe recebeu fundo creme, cabeçalho integrado ao destaque em verde profundo, chamada para analisar a carteira e apresentação das etapas de importação, validação e consulta. O fundo usa o vídeo original de abertura da Kanastra, salvo em `front/public/videos/kanastra-hero.mp4`, com capa local e sobreposição escura para leitura. A reprodução é automática, sem som e em loop. O fundo desaparece suavemente durante a rolagem e reaparece ao voltar ao topo; a reprodução pausa quando fica invisível ou a aba é ocultada. Em caso de falha ou preferência por movimento reduzido, a capa estática é exibida. O diagrama de etapas, os textos e a composição são escolhas de implementação para o fluxo do Antecipe. A tipografia usa as famílias já configuradas no projeto.

O cabeçalho é fixo e transparente sobre o vídeo no início da página. Após 48 pixels de rolagem, ele faz uma transição de 350 ms para fundo creme, sombra e logotipo verde; voltar ao topo restaura a transparência. A preferência por movimento reduzido desativa a transição.

A navegação passa a oferecer notas fiscais e dashboard após uma análise. O botão de seleção de arquivo tem acionamento próprio por teclado e mouse. A interface mostra o limite em MiB, conforme a validação existente de 50 × 1024 × 1024 bytes.

## Verificação

- ESLint e compilação de produção concluídos com sucesso em Node 24.20.0.
- Chrome: larguras de 320, 390, 768 e 1440 pixels, sem overflow horizontal na página inicial.
- API real em `http://127.0.0.1:3000`: upload de uma amostra de 10 linhas do CSV local retornou HTTP 200 e 10 notas na listagem.
- Links internos, seleção de arquivo, modal de regras, detalhes de uma nota, dashboard e nova análise conferidos no navegador.
- Nenhum erro de JavaScript registrado durante o fluxo verificado.
- A configuração dos validadores foi aberta para consulta; nenhum salvamento foi feito nessa verificação.

O REA também capturou a interface móvel e a abertura do modal de regras em 390 × 844: `ev_e583f4f1089f4938b34b5c499970b78517669ba6fa33fdb6e7ea548bd169747f`.

Arquivos gerados:

- [Antecipe no desktop](antecipe-desktop.png).
- [Cabeçalho fixo após rolagem](antecipe-topbar-scroll.png).
- [Antecipe no celular](antecipe-mobile.png).
- [Dashboard após upload](antecipe-dashboard.png).
- [Resultado da verificação no navegador](verificacao-frontend.json).

Para revisar localmente, a instância de desenvolvimento foi iniciada em `http://127.0.0.1:5175` com `VITE_API_URL=http://127.0.0.1:3000` definido somente no processo. O arquivo `.env` existente aponta para outro IP; sua configuração foi preservada. Alterações de código e evidências foram salvas localmente, sem publicação.

Limites: esta verificação usa uma amostra de 10 notas e não mede desempenho com o estoque completo. A observação da Kanastra cobre a página inicial e não estabelece o funcionamento de áreas autenticadas ou de todas as interações do site.
