import { ValidadoresService } from './validadores.service.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

export class AnaliseService {
  constructor(private readonly validadoresService = new ValidadoresService()) {}

  async recuperarValidadores(): Promise<ConfiguracaoValidadores['validadores']> {
    const configuracao = await this.validadoresService.get();
    return configuracao.validadores;
  }
}
