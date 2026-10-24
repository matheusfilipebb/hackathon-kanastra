export interface UploadLimits {
  maxConcurrent: number;
  requestsPerWindow: number;
  windowSeconds: number;
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} deve ser um inteiro positivo.`);
  return parsed;
}

export function readUploadLimits(): UploadLimits {
  return {
    maxConcurrent: positiveInteger(process.env.MAX_CONCURRENT_UPLOADS, 2, 'MAX_CONCURRENT_UPLOADS'),
    requestsPerWindow: positiveInteger(process.env.UPLOAD_RATE_LIMIT, 10, 'UPLOAD_RATE_LIMIT'),
    windowSeconds: positiveInteger(process.env.UPLOAD_RATE_WINDOW_SECONDS, 60, 'UPLOAD_RATE_WINDOW_SECONDS'),
  };
}

// One bucket per application instance, shared by all clients. IP headers cannot bypass it.
export class UploadLimitsService {
  private tokens: number;
  private updatedAt: number;
  private active = 0;
  constructor(private readonly limits: UploadLimits, private readonly now = () => performance.now()) {
    for (const value of Object.values(limits)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('Limites de upload devem ser inteiros positivos.');
    }
    this.tokens = limits.requestsPerWindow;
    this.updatedAt = now();
  }

  acquire(): { release: () => void } | { code: string; message: string; retryAfter: number } {
    const now = this.now();
    const interval = this.limits.windowSeconds * 1000 / this.limits.requestsPerWindow;
    this.tokens = Math.min(this.limits.requestsPerWindow, this.tokens + Math.max(0, now - this.updatedAt) / interval);
    this.updatedAt = now;
    if (this.tokens < 1) {
      return { code: 'UPLOAD_RATE_LIMIT', message: 'Muitos envios em pouco tempo. Aguarde antes de tentar novamente.', retryAfter: Math.max(1, Math.ceil((1 - this.tokens) * interval / 1000)) };
    }
    this.tokens--;
    if (this.active >= this.limits.maxConcurrent) {
      return { code: 'UPLOAD_CONCURRENCY_LIMIT', message: 'O servidor está analisando outros arquivos. Aguarde e tente novamente.', retryAfter: 5 };
    }
    this.active++;
    let released = false;
    return { release: () => { if (!released) { released = true; this.active--; } } };
  }
}
