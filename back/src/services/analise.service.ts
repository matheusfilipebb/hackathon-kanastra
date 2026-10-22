import { ValidadoresService } from './validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';
import { validarCnpjSacado } from '../validators/individuais/cnpj-sacado-valido.validator.js';

export class AnaliseService {
  constructor(private readonly validadoresService = new ValidadoresService()) {}

  async recuperarValidadores(): Promise<ConfiguracaoValidadores['validadores']> {
    const configuracao = await this.validadoresService.get();
    return configuracao.validadores;
  }

  validarCnpjSacado(documento: unknown): boolean {
    return validarCnpjSacado(documento);
  }
}
