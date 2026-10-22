# Comparação do motor de análise com o gabarito

## Dados e execução

Comparação feita com as 100.554 notas de `estoque_antecipe.csv`, a configuração de `back/data/validadores_antecipe.json`, o novo cadastro `back/data/cnpj_situacao_mock.csv` e `back/data/resultado_esperado_100k.json`.

O upload agora interpreta o CSV e executa as regras individuais e coletivas. A configuração e o cadastro são carregados uma vez por execução. As notas barradas individualmente não entram na concentração. O endpoint não consulta o gabarito.

Para reproduzir, execute dentro de `back/`:

```bash
npm run comparar -- ../../estoque_antecipe.csv ../docs/comparacao-resultado-esperado.json
```

O [relatório JSON](comparacao-resultado-esperado.json) inclui contagens, divergências por regra e as primeiras 20 diferenças, com os resultados calculados e esperados lado a lado. Os números abaixo correspondem aos arquivos fornecidos; alterações na configuração ou no cadastro podem mudar a comparação.

## Resultado geral

| Medida | Calculado | Gabarito |
| --- | ---: | ---: |
| Notas analisadas | 100.554 | 100.554 |
| Aprovadas | 69.195 | 85.215 |
| Barradas | 31.359 | 15.339 |

- Todas as 100.554 linhas e identificações estão alinhadas.
- 81.984 status coincidem: **81,5323%**.
- 77.080 resultados coincidem também no conjunto de motivos.
- A ordem dos motivos é desconsiderada na comparação; a identificação usa `linha` e `id`, preservando zeros à esquerda.

## Comparação das regras

| Regra | Recusas calculadas | Recusas no gabarito | Apenas no calculado | Apenas no gabarito |
| --- | ---: | ---: | ---: | ---: |
| `CNPJ_SACADO_VALIDO` | 0 | 0 | 0 | 0 |
| `SITUACAO_CADASTRAL_SACADO` | 22.999 | 2.317 | 22.074 | 1.392 |
| `TIPO_RECEBIVEL` | 9.842 | 9.842 | 0 | 0 |
| `VALOR_MINIMO` | 34 | 34 | 0 | 0 |
| `NAO_VENCIDA` | 0 | 0 | 0 | 0 |
| `PRAZO_MAXIMO` | 4.671 | 4.671 | 0 | 0 |
| `CONCENTRACAO_MAXIMA_SACADO` | 8 | 3.305 | 8 | 3.305 |

Uma nota pode ter mais de um motivo. `PRAZO_MINIMO` e `CONCENTRACAO_MAXIMA_CEDENTE` estão inativos na configuração; o dataset não verifica essas regras nesta comparação. Elas são cobertas pelos testes do backend.

## Referência das datas

Para o estoque histórico, o motor usa `DATA_AQUISICAO` de cada nota como referência. Essa escolha reproduz exatamente as recusas de `PRAZO_MAXIMO` do gabarito, além de não gerar recusas por `NAO_VENCIDA`.

O arquivo de instruções informa data-base de 22/10/2026, mas usar essa data como referência produziria 1.793 recusas por `NAO_VENCIDA` e 4.502 por `PRAZO_MAXIMO`, contra zero e 4.671 no gabarito. Portanto, o comportamento observado do gabarito é compatível com a aquisição como referência para essas regras. O service aceita uma referência comum opcional para análises em outra data; o upload realiza a análise histórica.

## Diferenças de situação cadastral

O novo cadastro contém 3.041 CNPJs. Das notas enviadas:

- 77.555 encontram situação `ATIVA`.
- 777 encontram situação não aceita: 493 `INAPTA`, 154 `SUSPENSA` e 130 `BAIXADA`.
- 22.222 têm CNPJ ausente no CSV cadastral e são recusadas conforme a política implementada.

Além disso, 1.392 notas recusadas por situação cadastral no gabarito têm situação `ATIVA` no CSV novo. Logo, apenas preencher os CNPJs ausentes não resolve toda a divergência: o cadastro fornecido e o gabarito também discordam sobre notas presentes.

As divergências cadastrais mudam quais notas entram nos totais de concentração.

## Diferenças de concentração

O motor mantém a regra aprovada: agrupar pela raiz do CNPJ, excluir notas já recusadas, remover as notas de maior linha do sacado e recalcular o total até respeitar o limite de 10%.

Para isolar essa regra das diferenças cadastrais, o script também faz uma análise diagnóstica usando as rejeições individuais do próprio gabarito como entrada da concentração. Esse diagnóstico é separado do processamento real do upload.

Nessa comparação isolada, o algoritmo retira **1.087 notas**; todas elas estão entre as 3.305 recusadas pelo gabarito. As outras **2.218 notas** seriam mantidas pela política de retirar somente o necessário.

Nos dados fornecidos, o gabarito recusa todas as notas individualmente elegíveis destes cinco grupos inicialmente acima de 10%:

| Fundo (CNPJ) | Raiz do sacado | Notas elegíveis | Recusadas pelo gabarito | Concentração inicial aproximada |
| --- | --- | ---: | ---: | ---: |
| 92.234.400/0001-80 | 58206002 | 1.169 | 1.169 | 12,6611% |
| 78.750.540/0001-80 | 83859239 | 1.095 | 1.095 | 18,4362% |
| 33.424.444/0001-03 | 99355794 | 1 | 1 | 15,2529% |
| 26.958.028/0001-20 | 20518898 | 555 | 555 | 12,3453% |
| 26.958.028/0001-20 | 34627997 | 485 | 485 | 11,3165% |

Esse resultado observado corresponde à exclusão integral desses grupos, enquanto a regra implementada tenta preservar as notas mais antigas. A compatibilidade integral exige conciliar a fonte cadastral e definir qual política de concentração deve prevalecer.

## Integração e limites atuais

- O controller retorna somente as notas do CSV recebido, mantendo sua ordem e linhas físicas, inclusive quando há campos multilinha ou linhas vazias.
- Os dois validadores coletivos são reaplicados até não haver novas recusas, para que uma retirada por cedente não deixe um sacado acima do limite.
- Cada fundo é calculado sobre o lote enviado; ainda não há consulta a uma carteira externa.
- A comparação considera `linha`, `id`, `status` e `barrado_por` quando aplicável. A precificação foi adicionada posteriormente à resposta das notas aprovadas e não é comparada, pois o gabarito não contém preços.
