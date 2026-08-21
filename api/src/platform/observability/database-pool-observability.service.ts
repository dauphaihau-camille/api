import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager, type Knex } from '@mikro-orm/postgresql';
import { ObservabilityService } from './observability.service';

type InstrumentableDbPool = {
  numFree: () => number;
  numPendingAcquires: () => number;
  numPendingCreates: () => number;
  numUsed: () => number;
  on: (
    eventName: 'acquireRequest' | 'acquireSuccess' | 'acquireFail',
    handler: (...args: unknown[]) => void,
  ) => void;
};

type KnexWithPool = Knex & {
  client?: {
    pool?: unknown;
  };
};

@Injectable()
export class DatabasePoolObservabilityService implements OnModuleInit {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly observabilityService: ObservabilityService,
  ) {}

  onModuleInit(): void {
    this.observabilityService.attachDbPool(
      extractInstrumentablePool(this.entityManager),
    );
  }
}

// ---------- Private helpers ----------

function extractInstrumentablePool(
  entityManager: EntityManager,
): InstrumentableDbPool | null {
  const knex = entityManager.getKnex() as KnexWithPool;
  const pool = knex.client?.pool;

  return isInstrumentableDbPool(pool) ? pool : null;
}

function isInstrumentableDbPool(pool: unknown): pool is InstrumentableDbPool {
  if (typeof pool !== 'object' || pool === null) {
    return false;
  }

  const candidate = pool as Partial<InstrumentableDbPool>;

  return typeof candidate.numFree === 'function'
    && typeof candidate.numPendingAcquires === 'function'
    && typeof candidate.numPendingCreates === 'function'
    && typeof candidate.numUsed === 'function'
    && typeof candidate.on === 'function';
}
