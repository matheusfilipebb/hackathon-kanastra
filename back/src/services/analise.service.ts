import { ValidadoresService } from './validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';
import { validarCnpjSacado } from '../validators/individuais/cnpj-sacado-valido.validator.js';
import { SituacaoCadastralRepository } from '../repositories/situacao-cadastral.repository.js';
import { validarSituacaoCadastralSacado } from '../validators/individuais/situacao-cadastral-sacado.validator.js';

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

  async iniciarExecucao() {
    const validadores = await this.recuperarValidadores();
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
    };
  }
}
