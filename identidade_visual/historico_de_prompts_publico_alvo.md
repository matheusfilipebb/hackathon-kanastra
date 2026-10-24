# Histórico de Prompts - Hackathon Antecipe

Abaixo estão listados todos os comandos e textos fornecidos durante o desenvolvimento do desafio.

### Prompt 1
Qual seria o público alvo de uma fintech que gerencia um fundo que compra notas de vendas a prazo de outras empresas gerando liquidez imediata e cobrando uma taxa sobre a compra?

---

### Prompt 2
https://app.notion.com/p/kanastra/Hackathon-Antecipe-dataset-para-os-participantes-4037e0475c338109906dee93fbf9cebb

Leia e indique quais são os diferenciais da Antecipa.

---

### Prompt 3
(Não resolva o problema do Hacjathon. Apenas indique quais são os diferênciais do negócio)

Hackathon Antecipe: dataset para os participantes
O desafio: portal Antecipe
O problema: uma pequena empresa vendeu a prazo e quer o dinheiro hoje. Ela “vende” essas notas para o fundo, mas o fundo só pode comprar o que cumpre regras: prazo máximo, valor mínimo, sacado (quem vai pagar) não pode estar concentrado demais, CNPJ ativo etc.
O que os times constroem:
- Design: a jornada da empresa, do upload das notas até ver quanto vai receber e por que algumas foram recusadas. O desafio de UX é explicar a recusa de forma clara.
- Front: upload de lote (CSV), tabela com status por nota e simulação do valor líquido (valor de face menos o desconto).
- Back: API que valida cada recebível contra critérios de elegibilidade configuráveis e calcula o preço de compra com uma taxa de desconto simples.
- Arquitetura: como modelar um motor de regras que o gestor do fundo altere sem deploy, e como garantir que o mesmo recebível não seja vendido duas vezes (idempotência e duplicidade).
Arquivos
Dados para o desafio Antecipe. Baixe os dois arquivos abaixo:
- Estoque: a carteira já comprada por 18 fundos, com cerca de 100 mil linhas (um único CSV, estoque_antecipe.csv, dentro do zip).
- Validadores: a configuração das regras do ANTECIPE FIDC. Cada validador tem um codigo, a chave ativo (só os ativos valem) e os parametros.
estoque_antecipe_100k.zip
validadores_antecipe.json
Requisitos mínimos de entrega
Prazo: até as 18h de sábado. Projetos enviados depois não são avaliados.
1. Repositório com o código, com acesso liberado para os jurados.
2. README com o passo a passo para rodar a aplicação do zero: dependências, comandos e variáveis de ambiente. Linguagem, framework e infraestrutura são livres.
3. Aplicação funcionando, com:
  - upload de um CSV de notas no mesmo formato do arquivo de exemplo (separador ;, decimal com vírgula, datas dd/mm/aaaa);
  - regras lidas do validadores_antecipe.json, sem valores fixos no código;
  - resultado de cada nota: aprovada ou recusada e, se recusada, o motivo, explicado de um jeito que a empresa entenda;
  - valor líquido de cada nota aprovada e o total a receber;
  - a mesma validação disponível pela tela e por uma API.
4. Relatório curto (pode estar no README): o que o time construiu, as tecnologias usadas, as principais decisões e o que ficou de fora.
5. Histórico dos prompts de IA usados durante o projeto (exportado ou em arquivo de texto).
6. Apresentação aos jurados: o time mostra a solução funcionando e responde perguntas.
Formato do CSV
Separador ;, decimal com vírgula, datas dd/mm/aaaa, UTF-8, cabeçalho na primeira linha. Data-base dos dados: 22 de outubro de 2026.
ColunaSignificadoNOME_FUNDO, DOC_FUNDOFundo que comprou a notaNOME_CEDENTE, DOC_CEDENTEEmpresa que vendeu a notaNOME_SACADO, DOC_SACADOCliente que vai pagar a notaNU_DOCUMENTONúmero da nota no sistema do cedente (cada empresa numera do seu jeito)TIPO_RECEBIVELDuplicata, Duplicata de Serviço, Cheque, CCB ou Nota ComercialVALOR_NOMINALValor de face, em reaisDATA_VENCIMENTO_ORIGINALData de vencimentoDATA_AQUISICAOData em que o fundo comprou a notaFORMULÁRIO DE ENTREGA

---

### Prompt 4
Há concorrentes no mercado?

---

### Prompt 5
crie um arquivo markdown com os prompts usados nesta conversacrie um arquivo markdown com os prompts usados nesta conversa