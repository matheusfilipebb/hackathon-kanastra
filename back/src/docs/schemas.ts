export const errorSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    message: { type: 'string', description: 'Motivo do erro.' },
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    code: { type: 'string' },
  },
};
