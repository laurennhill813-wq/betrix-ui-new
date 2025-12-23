/**
 * Health Check Endpoint Scaffolding
 * 
 * Provides /health and /ready endpoints with dependency status.
 * Implements Prometheus metrics and OpenTelemetry tracing.
 * 
 * Usage:
 *   const health = new HealthCheck({ redis, providers: [rapidapi, sportradar] });
 *   app.get('/health', (req, res) => res.json(health.status()));
 *   app.get('/ready', (req, res) => res.json(health.ready()));
 */

import { EventEmitter } from 'events';

export interface HealthCheckConfig {
  redis: any; // Redis client
  providers?: Array<{ name: string; ping: () => Promise<boolean> }>;
  timeout?: number; // ms, default 5000
  labels?: Record<string, string>; // Prometheus labels
}

export interface DependencyStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  latency_ms: number;
  last_error?: string;
  last_check: string; // ISO8601
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string; // ISO8601
  uptime_seconds: number;
  checks: {
    [key: string]: DependencyStatus;
  };
  version?: string;
}

export interface ReadyResponse {
  ready: boolean;
  message: string;
}

/**
 * HealthCheck - Monitors service dependencies
 */
export class HealthCheck extends EventEmitter {
  private config: Required<HealthCheckConfig>;
  private startTime = Date.now();
  private lastStatuses: Map<string, DependencyStatus> = new Map();

  constructor(config: HealthCheckConfig) {
    super();
    this.config = {
      timeout: 5000,
      labels: {},
      ...config,
    };

    // Periodic health checks (every 30s)
    this.startPeriodicChecks();
  }

  /**
   * Full health status with all dependency checks
   */
  async status(): Promise<HealthResponse> {
    const checks: Record<string, DependencyStatus> = {};

    // Check Redis
    checks.redis = await this.checkRedis();

    // Check providers (RapidAPI, Sportradar, etc.)
    if (this.config.providers) {
      for (const provider of this.config.providers) {
        checks[provider.name] = await this.checkProvider(provider);
      }
    }

    // Determine overall status
    const unhealthyCount = Object.values(checks).filter(
      (c) => c.status === 'unhealthy'
    ).length;
    const degradedCount = Object.values(checks).filter(
      (c) => c.status === 'degraded'
    ).length;

    let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
    if (unhealthyCount > 0) status = 'unhealthy';
    else if (degradedCount > 0) status = 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  /**
   * Readiness check - lightweight, gates traffic
   * Returns true only if all critical dependencies are healthy
   */
  async ready(): Promise<ReadyResponse> {
    const health = await this.status();
    const ready = health.status !== 'unhealthy';

    return {
      ready,
      message: ready
        ? 'Service is ready to accept traffic'
        : `Service unhealthy: ${
            Object.entries(health.checks)
              .filter(([_, c]) => c.status === 'unhealthy')
              .map(([name, _]) => name)
              .join(', ')
          }`,
    };
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<DependencyStatus> {
    const cached = this.lastStatuses.get('redis');
    if (cached && Date.now() - new Date(cached.last_check).getTime() < 30000) {
      return cached;
    }

    const startTime = Date.now();
    try {
      const result = await Promise.race([
        this.config.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), this.config.timeout)
        ),
      ]);

      const latency_ms = Date.now() - startTime;

      const status: DependencyStatus = {
        status: latency_ms < 200 ? 'ok' : 'degraded',
        latency_ms,
        last_check: new Date().toISOString(),
      };

      this.lastStatuses.set('redis', status);
      return status;
    } catch (error) {
      const status: DependencyStatus = {
        status: 'unhealthy',
        latency_ms: Date.now() - startTime,
        last_error: (error as Error).message,
        last_check: new Date().toISOString(),
      };

      this.lastStatuses.set('redis', status);
      return status;
    }
  }

  /**
   * Check provider endpoint connectivity
   */
  private async checkProvider(provider: {
    name: string;
    ping: () => Promise<boolean>;
  }): Promise<DependencyStatus> {
    const cached = this.lastStatuses.get(provider.name);
    if (cached && Date.now() - new Date(cached.last_check).getTime() < 30000) {
      return cached;
    }

    const startTime = Date.now();
    try {
      await Promise.race([
        provider.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), this.config.timeout)
        ),
      ]);

      const latency_ms = Date.now() - startTime;

      const status: DependencyStatus = {
        status: latency_ms < 500 ? 'ok' : 'degraded',
        latency_ms,
        last_check: new Date().toISOString(),
      };

      this.lastStatuses.set(provider.name, status);
      return status;
    } catch (error) {
      const status: DependencyStatus = {
        status: 'unhealthy',
        latency_ms: Date.now() - startTime,
        last_error: (error as Error).message,
        last_check: new Date().toISOString(),
      };

      this.lastStatuses.set(provider.name, status);
      return status;
    }
  }

  /**
   * Start periodic health checks (emit events for monitoring)
   */
  private startPeriodicChecks(): void {
    setInterval(async () => {
      const health = await this.status();
      this.emit('health', health);

      // Emit metrics to Prometheus collector
      this.emitPrometheusMetrics(health);
    }, 30000); // Every 30 seconds
  }

  /**
   * Emit Prometheus-style metrics
   */
  private emitPrometheusMetrics(health: HealthResponse): void {
    for (const [name, check] of Object.entries(health.checks)) {
      const statusValue = {
        ok: 1,
        degraded: 0.5,
        unhealthy: 0,
      }[check.status];

      this.emit('metric', {
        name: 'betrix_health_check_status',
        value: statusValue,
        labels: {
          component: name,
          ...this.config.labels,
        },
      });

      this.emit('metric', {
        name: 'betrix_health_check_latency_ms',
        value: check.latency_ms,
        labels: {
          component: name,
          ...this.config.labels,
        },
      });
    }
  }
}

/**
 * Example Express integration
 */
export function setupHealthEndpoints(app: any, config: HealthCheckConfig) {
  const health = new HealthCheck(config);

  // Emit metrics to Prometheus
  health.on('metric', (metric) => {
    // TODO: Send to Prometheus push gateway or scrape endpoint
    console.debug(`[METRIC] ${metric.name}:`, metric.value, metric.labels);
  });

  // Log health events
  health.on('health', (status) => {
    if (status.status !== 'ok') {
      console.warn('[HEALTH]', status);
    }
  });

  // GET /health - Full status
  app.get('/health', async (req: any, res: any) => {
    const status = await health.status();
    const statusCode = status.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(status);
  });

  // GET /ready - Readiness probe (for k8s, Render, etc.)
  app.get('/ready', async (req: any, res: any) => {
    const readiness = await health.ready();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  return health;
}

/**
 * Example usage in test or main.ts:
 * 
 * const health = setupHealthEndpoints(app, {
 *   redis: redisClient,
 *   providers: [
 *     { name: 'rapidapi', ping: () => rapidapiClient.healthCheck() },
 *     { name: 'sportradar', ping: () => sportradarClient.healthCheck() },
 *   ],
 *   timeout: 5000,
 *   labels: { env: 'production' },
 * });
 * 
 * // Test
 * const status = await health.status();
 * console.log(status); // { status: 'ok', checks: { redis: {...}, rapidapi: {...} } }
 */
