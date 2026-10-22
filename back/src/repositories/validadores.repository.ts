import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ConfiguracaoValidadores } from '../types/validadores.js';

export class ValidadoresRepository {
  constructor(private readonly configPath = fileURLToPath(
    new URL('../../data/validadores_antecipe.json', import.meta.url),
  )) {}

  async get(): Promise<ConfiguracaoValidadores> {
    return JSON.parse(await readFile(this.configPath, 'utf-8'));
  }

  async set(configuracao: ConfiguracaoValidadores): Promise<ConfiguracaoValidadores> {
    // A troca atômica mantém o arquivo anterior disponível durante a gravação.
    const tempPath = `${this.configPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, `${JSON.stringify(configuracao, null, 2)}\n`, {
        encoding: 'utf-8', flag: 'wx',
      });
      await rename(tempPath, this.configPath);
    } finally {
      await rm(tempPath, { force: true });
    }
    return configuracao;
  }
}
