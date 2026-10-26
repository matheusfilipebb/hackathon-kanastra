# Dashboard com troca de painéis

O dashboard ocupa a janela e tem dois painéis:

1. **Visão geral:** gráficos de pizza com o resultado das notas e os motivos de não aprovação.
2. **Por fundo:** gráfico de colunas comparando aprovadas e não aprovadas em todos os fundos do arquivo.

Rolar para baixo avança para as colunas; rolar para cima volta às pizzas. A transição combina opacidade e deslocamento, com bloqueio temporário para evitar trocas causadas pela inércia do scroll. A preferência por movimento reduzido remove a animação.

Os botões **Visão geral** e **Por fundo** permitem selecionar diretamente o painel. Com a área dos gráficos em foco, use as setas, Page Up, Page Down, Home, End ou espaço; Shift + espaço volta à visão geral. No celular, deslizar para cima ou para baixo também troca os painéis.

Legendas extensas e comparativos com muitos fundos têm rolagem interna. A rolagem da legenda é preservada enquanto há conteúdo naquela direção. Movimentos horizontais e Shift + scroll ficam disponíveis para percorrer as colunas.

O filtro por fundo é aplicado à visão geral. No comparativo, o seletor indica todos os fundos e fica desabilitado; ao voltar, a seleção anterior é mantida. Os eixos de quantidade usam valores inteiros.

Ao alternar entre Notas e Dashboard, o último painel de gráficos, a página da tabela e sua posição de rolagem são mantidos durante a análise atual. Alterar filtros reinicia a paginação das notas; uma nova análise reinicia a navegação. O cabeçalho do dashboard acompanha as dimensões do topo compacto de Notas no desktop, e os seletores de gráficos ficam centralizados também em telas grandes.

No celular, a navegação entre **Notas**, **Dashboard** e **Nova análise** fica em uma barra flutuante centralizada no rodapé, com ícones e nomes sempre visíveis. O dashboard reserva espaço abaixo dos controles para essa barra e para a área segura do dispositivo.

## Verificação

- Lint e compilação de produção concluídos.
- Conferência inicial com upload real de 75 notas.
- Respostas controladas com 120 notas, oito fundos e nove motivos de não aprovação para verificar filtros, legendas extensas e comparativos.
- Scroll nos dois sentidos, transição intermediária de opacidade, bloqueio de inércia, teclado, gestos touch enviados ao Chrome e movimento reduzido.
- Viewports de 1440 × 900, 1024 × 600, 390 × 844 e 320 × 568 sem scroll externo horizontal ou vertical.
- Retorno às Notas e início de nova análise, sem erros JavaScript no fluxo verificado.
- Alternância repetida entre o comparativo e a página 3 das notas, preservando painel, paginação e rolagem; filtros e nova análise reiniciam as posições correspondentes.

## Capturas

As capturas usam dados de exemplo e respostas controladas.

![Visão geral no desktop](dashboard-paineis-pizzas.png)

![Comparativo por fundo](dashboard-paineis-colunas.png)

![Dashboard e navegação no celular](dashboard-paineis-mobile.png)
