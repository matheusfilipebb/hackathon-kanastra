import { ValidadoresService } from './validadores.service.js';
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

  async iniciarExecucao() {
    const validadores = await this.recuperarValidadores();
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
