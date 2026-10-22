import type { ConfiguracaoValidadores } from '../types/validadores.js';
import type { RecebivelCsv } from '../types/recebivel-csv.js';
import { calcularPrazoDias } from '../utils/datas.js';
import { valorEmCentavos } from '../utils/valor-em-centavos.js';
import type { PrecificacaoSugerida } from '../types/precificacao.js';

export class PrecificacaoError extends Error {
  readonly statusCode = 422;
}

export class PrecificacaoService {
  private readonly configuracao: ConfiguracaoValidadores['precificacao'];
  private readonly numeradorTaxa: bigint;
  private readonly denominador: bigint;

  constructor(configuracao: ConfiguracaoValidadores['precificacao']) {
    if (configuracao.metodo !== 'DESCONTO_SIMPLES') {
      throw new PrecificacaoError('Método de precificação não suportado.');
    }
    if (!Number.isFinite(configuracao.taxa_mensal_percentual) || configuracao.taxa_mensal_percentual < 0
      || !Number.isSafeInteger(configuracao.base_dias) || configuracao.base_dias <= 0) {
      throw new PrecificacaoError('Precificação exige taxa não negativa e base de dias inteira positiva.');
    }
    this.configuracao = { ...configuracao };
    // Converte a taxa decimal em fração para evitar arredondamento intermediário.
    const [base, expoente = '0'] = String(configuracao.taxa_mensal_percentual).split('e');
    const [inteiro, decimal = ''] = base.split('.');
    const casas = decimal.length - Number(expoente);
    this.numeradorTaxa = BigInt(inteiro + decimal) * 10n ** BigInt(Math.max(0, -casas));
    this.denominador = 100n * BigInt(configuracao.base_dias) * 10n ** BigInt(Math.max(0, casas));
  }

  calcular(nota: Pick<RecebivelCsv, 'VALOR_NOMINAL' | 'DATA_AQUISICAO' | 'DATA_VENCIMENTO_ORIGINAL'>): PrecificacaoSugerida {
    const prazo = calcularPrazoDias(nota.DATA_VENCIMENTO_ORIGINAL, nota.DATA_AQUISICAO);
    if (prazo === null || prazo < 0) {
      throw new PrecificacaoError('A precificação exige datas válidas e vencimento igual ou posterior à aquisição.');
    }
    let nominal: bigint;
    try {
      nominal = valorEmCentavos(nota.VALOR_NOMINAL);
    } catch {
      throw new PrecificacaoError('Valor nominal inválido para precificação.');
    }
    if (nominal > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new PrecificacaoError('Valor nominal excede a precisão suportada pela resposta monetária.');
    }
    const numeradorDesconto = nominal * this.numeradorTaxa * BigInt(prazo);
    if (numeradorDesconto > nominal * this.denominador) {
      throw new PrecificacaoError('A taxa e o prazo configurados geram desconto superior ao valor nominal.');
    }
    // Arredonda uma única vez, para o centavo mais próximo; meio centavo sobe.
    const desconto = (2n * numeradorDesconto + this.denominador) / (2n * this.denominador);
    return {
      ...this.configuracao,
      prazo_dias: prazo,
      valor_nominal: Number(nominal) / 100,
      valor_desconto: Number(desconto) / 100,
      valor_liquido: Number(nominal - desconto) / 100,
    };
  }
}
