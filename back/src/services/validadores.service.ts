import { ValidadoresRepository } from '../repositories/validadores.repository.js';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

export const codigosValidadores = [
  'CNPJ_SACADO_VALIDO', 'SITUACAO_CADASTRAL_SACADO', 'TIPO_RECEBIVEL',
  'VALOR_MINIMO', 'NAO_VENCIDA', 'PRAZO_MAXIMO', 'PRAZO_MINIMO',
  'CONCENTRACAO_MAXIMA_SACADO', 'CONCENTRACAO_MAXIMA_CEDENTE',
] as const;
const tiposRecebiveis = new Set(['Duplicata', 'Duplicata de Serviço', 'Cheque', 'CCB', 'Nota Comercial']);
export class ValidadoresValidationError extends Error {}

function objeto(value: unknown, campo: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidadoresValidationError(`${campo} deve ser um objeto.`);
}
function campos(value: Record<string, unknown>, permitidos: string[], campo: string) {
  if (Object.keys(value).some(key => !permitidos.includes(key))) throw new ValidadoresValidationError(`${campo} contém campos não suportados.`);
}
function texto(value: unknown, campo: string) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
    throw new ValidadoresValidationError(`${campo} deve ser um texto de 1 a 200 caracteres, sem espaços nas extremidades.`);
  }
}
function numero(value: unknown, campo: string, inteiro = false, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new ValidadoresValidationError(`${campo} deve ser um número entre zero e ${max}.`);
  }
  if (inteiro && !Number.isSafeInteger(value)) throw new ValidadoresValidationError(`${campo} deve ser um inteiro seguro de dias.`);
}
function lista(value: unknown, campo: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.length || value.length > 50) throw new ValidadoresValidationError(`${campo} deve ser uma lista não vazia com até 50 valores.`);
  for (const item of value) texto(item, campo);
  if (new Set(value).size !== value.length) throw new ValidadoresValidationError(`${campo} não deve conter valores repetidos.`);
}

export function validarConfiguracao(config: unknown): asserts config is ConfiguracaoValidadores {
  objeto(config, 'configuracao');
  campos(config, ['fundo', 'validadores', 'precificacao'], 'configuracao');
  objeto(config.fundo, 'fundo');
  campos(config.fundo, ['nome', 'cnpj'], 'fundo');
  texto(config.fundo.nome, 'fundo.nome'); texto(config.fundo.cnpj, 'fundo.cnpj');
  if (!Array.isArray(config.validadores) || config.validadores.length > codigosValidadores.length) {
    throw new ValidadoresValidationError('validadores deve ser uma lista com até nove regras.');
  }
  const codigos = new Set<string>();
  for (const regra of config.validadores) {
    objeto(regra, 'validador'); campos(regra, ['codigo', 'ativo', 'parametros'], 'validador');
    if (typeof regra.codigo !== 'string' || !(codigosValidadores as readonly string[]).includes(regra.codigo)) {
      throw new ValidadoresValidationError('Código de validador não suportado.');
    }
    const codigo = regra.codigo;
    if (codigos.has(codigo)) throw new ValidadoresValidationError('Não é permitido repetir o código de um validador.');
    codigos.add(codigo);
    if (typeof regra.ativo !== 'boolean') throw new ValidadoresValidationError(`${codigo}.ativo deve ser booleano.`);
    objeto(regra.parametros, `${codigo}.parametros`);
    const parametros = regra.parametros;
    // Inactive rules are validated too, before they can be saved and activated.
    switch (codigo) {
      case 'CNPJ_SACADO_VALIDO':
      case 'NAO_VENCIDA':
        campos(parametros, [], codigo); break;
      case 'SITUACAO_CADASTRAL_SACADO':
        campos(parametros, ['situacoes_aceitas'], codigo);
        lista(parametros.situacoes_aceitas, `${codigo}.situacoes_aceitas`); break;
      case 'TIPO_RECEBIVEL':
        campos(parametros, ['tipos_aceitos'], codigo);
        lista(parametros.tipos_aceitos, `${codigo}.tipos_aceitos`);
        if (parametros.tipos_aceitos.some(tipo => !tiposRecebiveis.has(tipo))) {
          throw new ValidadoresValidationError('TIPO_RECEBIVEL.tipos_aceitos deve conter apenas: ' + [...tiposRecebiveis].join(', ') + '.');
        }
        break;
      case 'VALOR_MINIMO':
        campos(parametros, ['valor_minimo'], codigo);
        numero(parametros.valor_minimo, `${codigo}.valor_minimo`, false, Number.MAX_SAFE_INTEGER / 100); break;
      case 'PRAZO_MINIMO':
      case 'PRAZO_MAXIMO': {
        const campo = codigo === 'PRAZO_MINIMO' ? 'prazo_minimo_dias' : 'prazo_maximo_dias';
        campos(parametros, [campo], codigo); numero(parametros[campo], `${codigo}.${campo}`, true); break;
      }
      case 'CONCENTRACAO_MAXIMA_SACADO':
      case 'CONCENTRACAO_MAXIMA_CEDENTE':
        campos(parametros, codigo === 'CONCENTRACAO_MAXIMA_SACADO' ? ['percentual_maximo', 'agrupamento'] : ['percentual_maximo'], codigo);
        numero(parametros.percentual_maximo, `${codigo}.percentual_maximo`, false, 100);
        if (codigo === 'CONCENTRACAO_MAXIMA_SACADO' && parametros.agrupamento !== 'RAIZ_CNPJ') {
          throw new ValidadoresValidationError(`${codigo}.agrupamento deve ser RAIZ_CNPJ.`);
        }
        break;
    }
  }
  const minimo = config.validadores.find(regra => regra.codigo === 'PRAZO_MINIMO' && regra.ativo);
  const maximo = config.validadores.find(regra => regra.codigo === 'PRAZO_MAXIMO' && regra.ativo);
  if (minimo && maximo && minimo.parametros.prazo_minimo_dias > maximo.parametros.prazo_maximo_dias) {
    throw new ValidadoresValidationError('PRAZO_MINIMO não pode ser maior que PRAZO_MAXIMO quando ambos estão ativos.');
  }
  objeto(config.precificacao, 'precificacao');
  campos(config.precificacao, ['metodo', 'taxa_mensal_percentual', 'base_dias'], 'precificacao');
  if (config.precificacao.metodo !== 'DESCONTO_SIMPLES') throw new ValidadoresValidationError('Método de precificação não suportado.');
  numero(config.precificacao.taxa_mensal_percentual, 'precificacao.taxa_mensal_percentual');
  numero(config.precificacao.base_dias, 'precificacao.base_dias', true);
  if (config.precificacao.base_dias === 0) throw new ValidadoresValidationError('precificacao.base_dias deve ser maior que zero.');
}

export class ValidadoresService {
  constructor(private readonly repository = new ValidadoresRepository()) {}
  get() { return this.repository.get(); }
  async set(configuracao: ConfiguracaoValidadores) {
    validarConfiguracao(configuracao);
    return this.repository.set(configuracao);
  }
}
