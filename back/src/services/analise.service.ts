import { ValidadoresService, codigosValidadores } from './validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';
import { validarCnpjSacado } from '../validators/individuais/cnpj-sacado-valido.validator.js';
import { SituacaoCadastralRepository } from '../repositories/situacao-cadastral.repository.js';
import { validarSituacaoCadastralSacado } from '../validators/individuais/situacao-cadastral-sacado.validator.js';
import { validarTipoRecebivel } from '../validators/individuais/tipo-recebivel.validator.js';
import { validarValorMinimo } from '../validators/individuais/valor-minimo.validator.js';
import { validarNaoVencida } from '../validators/individuais/nao-vencida.validator.js';
import { validarPrazoMaximo } from '../validators/individuais/prazo-maximo.validator.js';
import { validarPrazoMinimo } from '../validators/individuais/prazo-minimo.validator.js';
import { agruparPorFundo } from '../utils/agrupar-por-fundo.js';
import { validarConcentracaoMaximaSacado } from '../validators/coletivos/concentracao-maxima-sacado.validator.js';
import type { RecebivelAnalisado, RecebivelAnalisadoCedente } from '../types/recebivel-analisado.js';
import { validarConcentracaoMaximaCedente } from '../validators/coletivos/concentracao-maxima-cedente.validator.js';
import type { RecebivelCsv, ResultadoAnalise } from '../types/recebivel-csv.js';
import { PrecificacaoService } from './precificacao.service.js';

function obterParametroNumerico(
  validadores: ConfiguracaoValidadores['validadores'],
  codigo: string,
  campo: string,
  inteiro = false,
): number | undefined {
  const regra = validadores.find(validador => validador.codigo === codigo && validador.ativo);
  if (!regra) return undefined;
  const valor = regra.parametros[campo];
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0
    || (inteiro && !Number.isSafeInteger(valor))) {
    throw new Error(`${codigo}.${campo} deve ser um número ${inteiro ? 'inteiro ' : ''}maior ou igual a zero.`);
  }
  return valor;
}

export class AnaliseService {
  constructor(
    private readonly validadoresService = new ValidadoresService(),
    private readonly situacaoCadastralRepository = new SituacaoCadastralRepository(),
  ) {}

  async recuperarValidadores(): Promise<ConfiguracaoValidadores['validadores']> {
    const configuracao = await this.validadoresService.get();
    return configuracao.validadores;
  }

  validarCnpjSacado(documento: unknown): boolean {
    return validarCnpjSacado(documento);
  }

  agruparPorFundo<T extends { DOC_FUNDO: string }>(recebiveis: readonly T[]): Map<string, T[]> {
    return agruparPorFundo(recebiveis);
  }

  async analisarRecebiveis(recebiveis: readonly RecebivelCsv[], dataReferencia?: string): Promise<ResultadoAnalise[]> {
    const execucao = await this.iniciarExecucao();
    let analisados = recebiveis.map(nota => {
      // A análise do estoque histórico usa a data em que cada título foi adquirido.
      const referencia = dataReferencia ?? nota.DATA_AQUISICAO;
      const verificacoes: Record<string, () => boolean> = {
        CNPJ_SACADO_VALIDO: () => this.validarCnpjSacado(nota.DOC_SACADO),
        SITUACAO_CADASTRAL_SACADO: () => execucao.validarSituacaoCadastralSacado(nota.DOC_SACADO),
        TIPO_RECEBIVEL: () => execucao.validarTipoRecebivel(nota.TIPO_RECEBIVEL),
        VALOR_MINIMO: () => execucao.validarValorMinimo(nota.VALOR_NOMINAL),
        NAO_VENCIDA: () => execucao.validarNaoVencida(nota.DATA_VENCIMENTO_ORIGINAL, referencia),
        PRAZO_MAXIMO: () => execucao.validarPrazoMaximo(nota.DATA_VENCIMENTO_ORIGINAL, referencia),
        PRAZO_MINIMO: () => execucao.validarPrazoMinimo(nota.DATA_VENCIMENTO_ORIGINAL, referencia),
      };
      const barradoPor = execucao.validadores
        .filter(regra => regra.ativo && Object.hasOwn(verificacoes, regra.codigo) && !verificacoes[regra.codigo]())
        .map(regra => regra.codigo);
      const status: 'APROVADO' | 'BARRADO' = barradoPor.length ? 'BARRADO' : 'APROVADO';
      return { ...nota, status, ...(barradoPor.length ? { barrado_por: barradoPor } : {}) };
    });

    // Uma retirada pelo cedente pode afetar novamente a concentração do sacado.
    // Nenhuma nota é reintroduzida: o ciclo termina quando não há novas recusas.
    let quantidadeAnterior: number;
    let quantidadeAtual = analisados.filter(nota => nota.status === 'BARRADO').length;
    do {
      quantidadeAnterior = quantidadeAtual;
      analisados = execucao.validarConcentracaoMaximaSacado(analisados);
      analisados = execucao.validarConcentracaoMaximaCedente(analisados);
      quantidadeAtual = analisados.filter(nota => nota.status === 'BARRADO').length;
    } while (quantidadeAtual > quantidadeAnterior);

    return analisados.map(nota => ({
      linha: nota.linha, id: nota.NU_DOCUMENTO, status: nota.status,
      ...(nota.barrado_por?.length ? { barrado_por: nota.barrado_por } : {}),
      ...(nota.status === 'APROVADO' ? { precificacao: execucao.precificarRecebivel(nota) } : {}),
    }));
  }

  async iniciarExecucao() {
    const configuracao = await this.validadoresService.get();
    const validadores = configuracao.validadores;
    if (validadores.some(regra => !(codigosValidadores as readonly string[]).includes(regra.codigo))) {
      throw new Error('Configuração contém código de validador não suportado. Corrija a configuração antes de analisar o lote.');
    }
    const precificacao = new PrecificacaoService(configuracao.precificacao);
    const concentracaoSacado = obterParametroNumerico(validadores, 'CONCENTRACAO_MAXIMA_SACADO', 'percentual_maximo');
    const concentracaoCedente = obterParametroNumerico(validadores, 'CONCENTRACAO_MAXIMA_CEDENTE', 'percentual_maximo');
    if (concentracaoSacado !== undefined && validadores.find(regra =>
      regra.codigo === 'CONCENTRACAO_MAXIMA_SACADO' && regra.ativo)?.parametros.agrupamento !== 'RAIZ_CNPJ') {
      throw new Error('CONCENTRACAO_MAXIMA_SACADO.agrupamento deve ser RAIZ_CNPJ.');
    }
    const valorMinimo = obterParametroNumerico(validadores, 'VALOR_MINIMO', 'valor_minimo');
    const prazoMaximo = obterParametroNumerico(validadores, 'PRAZO_MAXIMO', 'prazo_maximo_dias', true);
    const prazoMinimo = obterParametroNumerico(validadores, 'PRAZO_MINIMO', 'prazo_minimo_dias', true);
    const naoVencidaAtiva = validadores.some(validador => validador.codigo === 'NAO_VENCIDA' && validador.ativo);
    const regraTipo = validadores.find(validador => validador.codigo === 'TIPO_RECEBIVEL' && validador.ativo);
    const tiposAceitos = regraTipo?.parametros.tipos_aceitos;
    if (regraTipo && (!Array.isArray(tiposAceitos) || tiposAceitos.length === 0
      || tiposAceitos.some(tipo => typeof tipo !== 'string' || tipo.trim() === ''))) {
      throw new Error('TIPO_RECEBIVEL.tipos_aceitos deve ser uma lista não vazia de tipos.');
    }
    const tipos: string[] = Array.isArray(tiposAceitos) ? [...tiposAceitos] : [];
    const regra = validadores.find(validador => validador.codigo === 'SITUACAO_CADASTRAL_SACADO' && validador.ativo);
    const situacoesAceitas = regra?.parametros.situacoes_aceitas;
    if (regra && (!Array.isArray(situacoesAceitas) || situacoesAceitas.length === 0
      || situacoesAceitas.some(situacao => typeof situacao !== 'string' || situacao.trim() === ''))) {
      throw new Error('SITUACAO_CADASTRAL_SACADO.situacoes_aceitas deve ser uma lista não vazia de situações.');
    }

    // Cada execução captura sua própria lista; as notas consultam somente este mapa.
    const situacoes = regra ? await this.situacaoCadastralRepository.getAll() : new Map<string, string>();
    const aceitas: string[] = Array.isArray(situacoesAceitas) ? [...situacoesAceitas] : [];
    return {
      validadores,
      precificarRecebivel: (nota: RecebivelCsv) => precificacao.calcular(nota),
      validarSituacaoCadastralSacado: (documento: unknown): boolean =>
        !regra || validarSituacaoCadastralSacado(documento, situacoes, aceitas),
      validarTipoRecebivel: (tipo: unknown): boolean =>
        !regraTipo || validarTipoRecebivel(tipo, tipos),
      validarValorMinimo: (valorNominal: unknown): boolean =>
        valorMinimo === undefined || validarValorMinimo(valorNominal, valorMinimo),
      validarNaoVencida: (vencimento: unknown, referencia: unknown): boolean =>
        !naoVencidaAtiva || validarNaoVencida(vencimento, referencia),
      validarPrazoMaximo: (vencimento: unknown, referencia: unknown): boolean =>
        prazoMaximo === undefined || validarPrazoMaximo(vencimento, referencia, prazoMaximo),
      validarPrazoMinimo: (vencimento: unknown, referencia: unknown): boolean =>
        prazoMinimo === undefined || validarPrazoMinimo(vencimento, referencia, prazoMinimo),
      validarConcentracaoMaximaSacado: <T extends RecebivelAnalisado>(recebiveis: readonly T[]): T[] =>
        concentracaoSacado === undefined ? [...recebiveis] : validarConcentracaoMaximaSacado(recebiveis, concentracaoSacado),
      validarConcentracaoMaximaCedente: <T extends RecebivelAnalisadoCedente>(recebiveis: readonly T[]): T[] =>
        concentracaoCedente === undefined ? [...recebiveis] : validarConcentracaoMaximaCedente(recebiveis, concentracaoCedente),
    };
  }
}
