/** Estado reportado por el endpoint publico `GET /health`. */
export type HealthStatus = 'ok' | 'error' | 'shutting_down';

export interface HealthIndicatorResult {
  status: 'up' | 'down';
  message?: string;
  /** Latencia de la comprobacion en milisegundos. */
  responseTime?: number;
}

export interface HealthResponse {
  status: HealthStatus;
  info?: Record<string, HealthIndicatorResult>;
  error?: Record<string, HealthIndicatorResult>;
  details?: Record<string, HealthIndicatorResult>;
}
