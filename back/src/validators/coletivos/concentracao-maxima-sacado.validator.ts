import type { RecebivelAnalisado } from '../../types/recebivel-analisado.js';
import { agruparPorFundo } from '../../utils/agrupar-por-fundo.js';
import { valorEmCentavos } from '../../utils/valor-em-centavos.js';

const codigo = 'CONCENTRACAO_MAXIMA_SACADO';

function percentualComoFracao(percentual: number) {
  const [base, expoente = '0'] = String(percentual).split('e');
  const [inteiro, decimal = ''] = base.split('.');
  const casas = decimal.length - Number(expoente);
  return {
    numerador: BigInt(inteiro + decimal) * 10n ** BigInt(Math.max(0, -casas)),
    denominador: 10n ** BigInt(Math.max(0, casas)),
  };
}

export function validarConcentracaoMaximaSacado<T extends RecebivelAnalisado>(
  recebiveis: readonly T[],
  percentualMaximo: number,
): T[] {
  if (!Number.isFinite(percentualMaximo) || percentualMaximo < 0) {
    throw new Error(`${codigo}.percentual_maximo deve ser um número maior ou igual a zero.`);
  }
  const limite = percentualComoFracao(percentualMaximo);
  const resultado = recebiveis.map(nota => ({
    ...nota,
    ...(nota.barrado_por ? { barrado_por: [...nota.barrado_por] } : {}),
  }));
  const linhas = new Set<number>();

  for (const notasFundo of agruparPorFundo(resultado).values()) {
    const sacados = new Map<string, { total: bigint; notas: Array<{ nota: T; valor: bigint }> }>();
    let totalFundo = 0n;
    for (const nota of notasFundo) {
      // Uma nota já barrada não entra no numerador nem no total do fundo.
      if (nota.status === 'BARRADO') continue;
      if (!Number.isSafeInteger(nota.linha) || nota.linha < 2 || linhas.has(nota.linha)) {
        throw new Error('As notas aprovadas devem ter linhas do CSV válidas e únicas.');
      }
      linhas.add(nota.linha);
      const documento = nota.DOC_SACADO.trim();
      if (!/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(documento)) {
        throw new Error(`CNPJ do sacado inválido para agrupamento na linha ${nota.linha}.`);
      }
      const raiz = documento.replace(/[./-]/g, '').slice(0, 8);
      const valor = valorEmCentavos(nota.VALOR_NOMINAL);
      const grupo = sacados.get(raiz) ?? { total: 0n, notas: [] };
      grupo.total += valor;
      grupo.notas.push({ nota, valor });
      sacados.set(raiz, grupo);
      totalFundo += valor;
    }

    for (const grupo of sacados.values()) {
      grupo.notas.sort((a, b) => a.nota.linha - b.nota.linha);
    }

    // Retirar uma nota reduz o fundo e pode tornar outro sacado concentrado.
    // Reavalia os grupos até que todos respeitem o limite no total restante.
    let houveRetirada: boolean;
    do {
      houveRetirada = false;
      for (const grupo of sacados.values()) {
        while (totalFundo > 0n
          && grupo.total * 100n * limite.denominador > totalFundo * limite.numerador) {
          const ultima = grupo.notas.pop()!;
          ultima.nota.status = 'BARRADO';
          ultima.nota.barrado_por = [...(ultima.nota.barrado_por ?? []), codigo];
          grupo.total -= ultima.valor;
          totalFundo -= ultima.valor;
          houveRetirada = true;
        }
      }
    } while (houveRetirada);
  }
  return resultado;
}
