export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number; // Falhas consecutivas para abrir (default: 5)
  readonly halfOpenMaxAttempts: number; // Tentativas em half-open (default: 1)
  readonly openDurationMs: number; // Tempo em OPEN antes de half-open (default: 30_000)
  readonly successThreshold: number; // Sucessos para fechar (default: 2)
}

export const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  halfOpenMaxAttempts: 1,
  openDurationMs: 30_000,
  successThreshold: 2,
};

export class CircuitBreakerState {
  private constructor(
    public readonly state: CircuitState,
    public readonly consecutiveFailures: number,
    public readonly consecutiveSuccesses: number,
    public readonly lastFailureAt: number,
    public readonly openedAt: number,
    public readonly halfOpenAttempts: number,
  ) {}

  static readonly INITIAL = new CircuitBreakerState(
    CircuitState.CLOSED, 0, 0, 0, 0, 0,
  );

  static create(
    state: CircuitState,
    consecutiveFailures: number,
    consecutiveSuccesses: number,
    lastFailureAt: number,
    openedAt: number,
    halfOpenAttempts: number,
  ): CircuitBreakerState {
    return new CircuitBreakerState(
      state,
      consecutiveFailures,
      consecutiveSuccesses,
      lastFailureAt,
      openedAt,
      halfOpenAttempts,
    );
  }

  recordSuccess(): CircuitBreakerState {
    switch (this.state) {
      case CircuitState.CLOSED:
        return new CircuitBreakerState(
          CircuitState.CLOSED,
          0,
          this.consecutiveSuccesses + 1,
          this.lastFailureAt,
          this.openedAt,
          0,
        );
      case CircuitState.HALF_OPEN:
        if (this.consecutiveSuccesses + 1 >= DEFAULT_CB_CONFIG.successThreshold) {
          return CircuitBreakerState.INITIAL;
        }
        return new CircuitBreakerState(
          CircuitState.HALF_OPEN,
          0,
          this.consecutiveSuccesses + 1,
          this.lastFailureAt,
          this.openedAt,
          this.halfOpenAttempts,
        );
      default:
        return this;
    }
  }

  recordFailure(config: CircuitBreakerConfig = DEFAULT_CB_CONFIG): CircuitBreakerState {
    const now = Date.now();
    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.consecutiveFailures + 1 >= config.failureThreshold) {
          return new CircuitBreakerState(
            CircuitState.OPEN,
            this.consecutiveFailures + 1,
            0,
            now,
            now,
            0,
          );
        }
        return new CircuitBreakerState(
          CircuitState.CLOSED,
          this.consecutiveFailures + 1,
          0,
          now,
          this.openedAt,
          0,
        );
      case CircuitState.HALF_OPEN:
        return new CircuitBreakerState(
          CircuitState.OPEN,
          this.consecutiveFailures + 1,
          0,
          now,
          now,
          0,
        );
      default:
        return this;
    }
  }

  maybeTransitionToHalfOpen(config: CircuitBreakerConfig = DEFAULT_CB_CONFIG): CircuitBreakerState {
    if (this.state !== CircuitState.OPEN) return this;
    if (Date.now() - this.openedAt >= config.openDurationMs) {
      return new CircuitBreakerState(
        CircuitState.HALF_OPEN,
        this.consecutiveFailures,
        0,
        this.lastFailureAt,
        this.openedAt,
        0,
      );
    }
    return this;
  }
}
