import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export class SituacaoCadastralRepository {
  constructor(private readonly csvPath = fileURLToPath(
    new URL('../../data/cnpj_situacao_mock.csv', import.meta.url),
  )) {}

  async getAll(): Promise<ReadonlyMap<string, string>> {
    const content = await readFile(this.csvPath, 'utf-8');
    const [header, ...rows] = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (header.trim() !== 'DOC;SITUACAO_CADASTRAL') {
      throw new Error('Cabeçalho inválido no CSV de situação cadastral.');
    }

    const situacoes = new Map<string, string>();
    for (const [index, row] of rows.entries()) {
      if (row.trim() === '') continue;
      const fields = row.split(';').map(field => field.trim());
      const [documento, situacao] = fields;
      if (fields.length !== 2 || !/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(documento) || !situacao) {
        throw new Error(`Registro inválido no CSV de situação cadastral, linha ${index + 2}.`);
      }
      const cnpj = documento.replace(/[./-]/g, '');
      if (situacoes.has(cnpj)) {
        throw new Error(`CNPJ duplicado no CSV de situação cadastral, linha ${index + 2}.`);
      }
      situacoes.set(cnpj, situacao);
    }
    return situacoes;
  }
}
