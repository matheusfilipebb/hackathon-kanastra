import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { AnaliseService } from '../src/services/analise.service.js';
import { parseRecebiveisCsv } from '../src/utils/parse-recebiveis-csv.js';
import type { ResultadoAnalise } from '../src/types/recebivel-csv.js';
import { SituacaoCadastralRepository } from '../src/repositories/situacao-cadastral.repository.js';
import { ValidadoresService } from '../src/services/validadores.service.js';
import { validarConcentracaoMaximaSacado } from '../src/validators/coletivos/concentracao-maxima-sacado.validator.js';

const csvPath = process.argv[2] ?? '../../estoque_antecipe.csv';
const outputPath = process.argv[3];
const recebiveis = parseRecebiveisCsv(await readFile(csvPath, 'utf-8'));
const esperado: ResultadoAnalise[] = JSON.parse(await readFile(
  new URL('../data/resultado_esperado_100k.json', import.meta.url), 'utf-8',
));
const inicio = performance.now();
const calculado = await new AnaliseService().analisarRecebiveis(recebiveis);
const duracaoMs = Math.round(performance.now() - inicio);
let statusIguais = 0;
let resultadosIguais = 0;
let identificacaoIgual = 0;
const statusCalculado = { APROVADO: 0, BARRADO: 0 };
const statusEsperado = { APROVADO: 0, BARRADO: 0 };
const porRegra: Record<string, { calculado: number; esperado: number; apenas_calculado: number; apenas_esperado: number }> = {};
const amostras: Array<{ calculado: ResultadoAnalise | null; esperado: ResultadoAnalise | null }> = [];
for (let index = 0; index < Math.max(calculado.length, esperado.length); index++) {
  const atual = calculado[index];
  const alvo = esperado[index];
  if (atual) statusCalculado[atual.status]++;
  if (alvo) statusEsperado[alvo.status]++;
  const identificacao = !!atual && !!alvo && atual.linha === alvo.linha && atual.id === alvo.id;
  if (identificacao) identificacaoIgual++;
  const statusIgual = identificacao && atual.status === alvo.status;
  if (statusIgual) statusIguais++;
  const motivos = new Set(atual?.barrado_por ?? []);
  const motivosEsperados = new Set(alvo?.barrado_por ?? []);
  const motivosIguais = motivos.size === motivosEsperados.size && [...motivos].every(motivo => motivosEsperados.has(motivo));
  if (statusIgual && motivosIguais) resultadosIguais++;
  else if (amostras.length < 20) amostras.push({ calculado: atual ?? null, esperado: alvo ?? null });
  for (const codigo of new Set([...motivos, ...motivosEsperados])) {
    const contagem = porRegra[codigo] ??= { calculado: 0, esperado: 0, apenas_calculado: 0, apenas_esperado: 0 };
    if (motivos.has(codigo)) contagem.calculado++;
    if (motivosEsperados.has(codigo)) contagem.esperado++;
    if (motivos.has(codigo) && !motivosEsperados.has(codigo)) contagem.apenas_calculado++;
    if (!motivos.has(codigo) && motivosEsperados.has(codigo)) contagem.apenas_esperado++;
  }
}
// Diagnósticos separados da execução real: o gabarito nunca entra no motor do upload.
const cadastro = await new SituacaoCadastralRepository().getAll();
const diagnosticoCadastro = { notas_sem_cnpj_no_cadastro: 0, recusadas_no_gabarito_mas_ativas_no_csv: 0 };
for (const [index, nota] of recebiveis.entries()) {
  const situacao = cadastro.get(nota.DOC_SACADO.replace(/[./-]/g, ''));
  if (situacao === undefined) diagnosticoCadastro.notas_sem_cnpj_no_cadastro++;
  if (situacao === 'ATIVA' && esperado[index]?.barrado_por?.includes('SITUACAO_CADASTRAL_SACADO')) {
    diagnosticoCadastro.recusadas_no_gabarito_mas_ativas_no_csv++;
  }
}
const configuracao = await new ValidadoresService().get();
const percentual = configuracao.validadores.find(regra => regra.codigo === 'CONCENTRACAO_MAXIMA_SACADO')?.parametros.percentual_maximo;
let concentracaoIsolada;
if (typeof percentual === 'number' && identificacaoIgual === recebiveis.length && esperado.length === recebiveis.length) {
  const notasComIndividuaisDoGabarito = recebiveis.map((nota, index) => {
    const motivos = (esperado[index].barrado_por ?? []).filter(codigo => !codigo.startsWith('CONCENTRACAO_'));
    const status: 'APROVADO' | 'BARRADO' = motivos.length ? 'BARRADO' : 'APROVADO';
    return { ...nota, status, ...(motivos.length ? { barrado_por: motivos } : {}) };
  });
  const isolado = validarConcentracaoMaximaSacado(notasComIndividuaisDoGabarito, percentual);
  concentracaoIsolada = { percentual_maximo: percentual, calculado: 0, esperado: 0, apenas_calculado: 0, apenas_esperado: 0 };
  for (const [index, nota] of isolado.entries()) {
    const atual = nota.barrado_por?.includes('CONCENTRACAO_MAXIMA_SACADO') ?? false;
    const alvo = esperado[index].barrado_por?.includes('CONCENTRACAO_MAXIMA_SACADO') ?? false;
    if (atual) concentracaoIsolada.calculado++;
    if (alvo) concentracaoIsolada.esperado++;
    if (atual && !alvo) concentracaoIsolada.apenas_calculado++;
    if (!atual && alvo) concentracaoIsolada.apenas_esperado++;
  }
}
const relatorio = {
  referencia_datas: 'DATA_AQUISICAO de cada nota',
  duracao_analise_ms: duracaoMs,
  linhas_csv: recebiveis.length, resultados_calculados: calculado.length, resultados_esperados: esperado.length,
  identificacoes_iguais: identificacaoIgual,
  status_iguais: statusIguais,
  percentual_status_iguais: Number((statusIguais / Math.max(calculado.length, esperado.length) * 100).toFixed(4)),
  resultados_iguais_incluindo_motivos: resultadosIguais,
  status_calculado: statusCalculado, status_esperado: statusEsperado,
  por_regra: porRegra,
  diagnostico_cadastro: diagnosticoCadastro,
  concentracao_isolada_usando_rejeicoes_individuais_do_gabarito: concentracaoIsolada,
  amostras_divergentes: amostras,
};
const json = `${JSON.stringify(relatorio, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, json);
process.stdout.write(json);
