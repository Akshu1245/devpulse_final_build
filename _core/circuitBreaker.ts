/**
 * PHASE 9C: Circuit Breaker Pattern for Resilience
 * 
 * Implements circuit breaker for:
 * - Database connection failures
 * - External API calls
 * - Cache failures
 * - Inter-service communication
 * 
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED
 */

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes in HALF_OPEN before closing
  timeout: number; // Time in ms before transitioning from OPEN to HALF_OPEN
  name: string; // Circuit breaker identifier
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onError?: (error: Error, state: CircuitState) => void;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new Error(
          `[CircuitBreaker:${this.config.name}] Circuit is OPEN (${this.getTimeUntilReset()}ms until retry)`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Called on successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Called on failed execution
   */
  private onFailure(error: Error): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.config.onError) {
      this.config.onError(error, this.state);
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN returns to OPEN
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceFailure = Date.now() - this.lastFailureTime;
    return timeSinceFailure >= this.config.timeout;
  }

  /**
   * Get milliseconds until reset is attempted
   */
  public getTimeUntilReset(): number {
    if (this.state !== CircuitState.OPEN || !this.lastFailureTime) {
      return 0;
    }

    const timeSinceFailure = Date.now() - this.lastFailureTime;
    const timeUntilReset = this.config.timeout - timeSinceFailure;
    return Math.max(0, timeUntilReset);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    if (newState === this.state) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    // Reset counters based on new state
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }

    console.log(
      `[CircuitBreaker:${this.config.name}] Transitioned: ${oldState} → ${newState}`
    );

    if (this.config.onStateChange) {
      this.config.onStateChange(oldState, newState);
    }
  }

  /**
   * Get circuit breaker metrics
   */
  public getMetrics(): {
    state: CircuitState;
    successRate: number;
    failureRate: number;
    totalRequests: number;
    totalFailures: number;
    failureCount: number;
    uptime: string;
  } {
    const successRate =
      this.totalRequests > 0
        ? ((this.totalRequests - this.totalFailures) / this.totalRequests) * 100
        : 100;

    const failureRate =
      this.totalRequests > 0
        ? (this.totalFailures / this.totalRequests) * 100
        : 0;

    return {
      state: this.state,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      failureCount: this.failureCount,
      uptime: this.getUptime(),
    };
  }

  private getUptime(): string {
    if (!this.lastFailureTime) {
      return '∞ (never failed)';
    }

    const uptimeMs = Date.now() - this.lastFailureTime;
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Force circuit to specific state (for testing)
   */
  public setState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  public reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.transitionTo(CircuitState.CLOSED);
  }
}

// ==================== COMMON CIRCUIT BREAKERS ====================

/**
 * Database circuit breaker (3 failures → open for 30 seconds)
 */
export const dbCircuitBreaker = new CircuitBreaker({
  name: 'database',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
});

/**
 * Cache circuit breaker (5 failures → open for 10 seconds)
 */
export const cacheCircuitBreaker = new CircuitBreaker({
  name: 'cache',
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 10000,
});

/**
 * External API circuit breaker (3 failures → open for 60 seconds)
 */
export const externalApiCircuitBreaker = new CircuitBreaker({
  name: 'external_api',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000,
});

/**
 * Queue circuit breaker (BullMQ)
 */
export const queueCircuitBreaker = new CircuitBreaker({
  name: 'queue',
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 20000,
});

/**
 * WebSocket circuit breaker
 */
export const websocketCircuitBreaker = new CircuitBreaker({
  name: 'websocket',
  failureThreshold: 2,
  successThreshold: 1,
  timeout: 5000,
});

// ==================== CIRCUIT BREAKER MANAGER ====================

class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  public register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  public getBreaker(name: string): CircuitBreaker {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Circuit breaker '${name}' not found`);
    }
    return breaker;
  }

  public getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }

  public resetAll(): void {
    this.breakers.forEach((breaker) => {
      breaker.reset();
    });
  }

  public getHealth(): {
    healthy: boolean;
    openCircuits: string[];
    degradedCircuits: string[];
  } {
    const openCircuits: string[] = [];
    const degradedCircuits: string[] = [];

    this.breakers.forEach((breaker, name) => {
      const state = breaker.getState();
      const metrics = breaker.getMetrics();

      if (state === CircuitState.OPEN) {
        openCircuits.push(name);
      } else if (metrics.failureRate > 10) {
        // > 10% failure rate = degraded
        degradedCircuits.push(name);
      }
    });

    return {
      healthy: openCircuits.length === 0 && degradedCircuits.length === 0,
      openCircuits,
      degradedCircuits,
    };
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();

// Register default breakers
circuitBreakerManager.register('database', dbCircuitBreaker);
circuitBreakerManager.register('cache', cacheCircuitBreaker);
circuitBreakerManager.register('external_api', externalApiCircuitBreaker);
circuitBreakerManager.register('queue', queueCircuitBreaker);
circuitBreakerManager.register('websocket', websocketCircuitBreaker);

export { CircuitBreakerManager };
