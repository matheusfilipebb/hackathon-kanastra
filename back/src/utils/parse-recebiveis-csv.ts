import type { RecebivelCsv } from '../types/recebivel-csv.js';

const columns = [
  'NOME_FUNDO', 'DOC_FUNDO', 'NOME_CEDENTE', 'DOC_CEDENTE',
  'NOME_SACADO', 'DOC_SACADO', 'NU_DOCUMENTO', 'TIPO_RECEBIVEL',
  'VALOR_NOMINAL', 'DATA_VENCIMENTO_ORIGINAL', 'DATA_AQUISICAO',
] as const;

export function parseRecebiveisCsv(content: string): RecebivelCsv[] {
  const rows: Array<{ linha: number; values: string[] }> = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let linha = 1;
  let inicioRegistro = 1;

  const finishField = () => {
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (row.length !== 1 || row[0].trim() !== '') rows.push({ linha: inicioRegistro, values: row });
    row = [];
  };

  const text = content.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
        if (character === '\r' || (character === '\n' && text[index - 1] !== '\r')) linha++;
      }
    } else if (character === ';') {
      finishField();
    } else if (character === '\n' || character === '\r') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
      linha++;
      inicioRegistro = linha;
    } else if (character === '"' && field === '' && !closedQuote) {
      quoted = true;
    } else {
      if (closedQuote || character === '"') throw new Error('Aspas inválidas no CSV.');
      field += character;
    }
  }
  if (quoted) throw new Error('Campo com aspas não finalizado.');
  if (field !== '' || row.length > 0 || closedQuote) finishRow();

  const header = rows.shift()?.values;
  if (!header || header.length !== columns.length || !columns.every(column => header.includes(column))) {
    throw new Error('O cabeçalho deve conter as 11 colunas do arquivo de exemplo.');
  }
  if (rows.length === 0) throw new Error('O CSV deve conter pelo menos uma nota.');

  return rows.map(({ linha, values }) => {
    if (values.length !== header.length) {
      throw new Error(`Quantidade de campos inválida na linha ${linha}.`);
    }
    const campos = Object.fromEntries(header.map((column, index) => [column, values[index]])) as Omit<RecebivelCsv, 'linha'>;
    return { ...campos, linha };
  });
}
