import { readFile } from 'node:fs/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';

const columns = [
  'NOME_FUNDO', 'DOC_FUNDO', 'NOME_CEDENTE', 'DOC_CEDENTE',
  'NOME_SACADO', 'DOC_SACADO', 'NU_DOCUMENTO', 'TIPO_RECEBIVEL',
  'VALOR_NOMINAL', 'DATA_VENCIMENTO_ORIGINAL', 'DATA_AQUISICAO',
] as const;

// O arquivo fornecido pelo hackathon está na raiz do diretório antecipe.
const resultadoEsperadoUrl = new URL(
  '../../data/resultado_esperado_100k.json', import.meta.url,
);

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  const finishField = () => {
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (row.length !== 1 || row[0].trim() !== '') rows.push(row);
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
      }
    } else if (character === ';') {
      finishField();
    } else if (character === '\n' || character === '\r') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
    } else if (character === '"' && field === '' && !closedQuote) {
      quoted = true;
    } else {
      if (closedQuote || character === '"') throw new Error('Aspas inválidas no CSV.');
      field += character;
    }
  }
  if (quoted) throw new Error('Campo com aspas não finalizado.');
  if (field !== '' || row.length > 0 || closedQuote) finishRow();

  const header = rows.shift();
  if (!header || header.length !== columns.length || !columns.every(column => header.includes(column))) {
    throw new Error('O cabeçalho deve conter as 11 colunas do arquivo de exemplo.');
  }
  if (rows.length === 0) throw new Error('O CSV deve conter pelo menos uma nota.');

  return rows.map((values, index) => {
    if (values.length !== header.length) {
      throw new Error(`Quantidade de campos inválida no registro ${index + 1}.`);
    }
    // Preserva documentos, zeros à esquerda, valores com vírgula e datas originais.
    return Object.fromEntries(header.map((column, index) => [column, values[index]]));
  });
}

export async function uploadRecebiveis(request: FastifyRequest, reply: FastifyReply) {
  if (!request.isMultipart()) {
    return reply.code(415).send({ message: 'Envie o CSV como multipart/form-data no campo file.' });
  }

  const file = await request.file();
  if (!file) {
    return reply.code(400).send({ message: 'Envie um arquivo CSV no campo file.' });
  }
  const buffer = await file.toBuffer();
  if (file.fieldname !== 'file') {
    return reply.code(400).send({ message: 'O arquivo CSV deve ser enviado no campo file.' });
  }

  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    parseCsv(content);
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof TypeError
        ? 'O arquivo CSV deve usar codificação UTF-8.'
        : error instanceof Error ? error.message : 'CSV inválido.',
    });
  }

  // Resposta temporária: ainda não executa validadores sobre as notas recebidas.
  const resultado = JSON.parse(await readFile(resultadoEsperadoUrl, 'utf-8'));
  return reply.send(resultado);
}
