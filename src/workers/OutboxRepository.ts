import { DATABASE_ROUTINES } from "../contracts/database.js";
import { EVENT_TYPES, type DomainEvent, type EventType } from "../contracts/events.js";
import type { OutboxRepositoryContract } from "../contracts/repositories.js";
import {
  database as defaultDatabase,
  type RoutineExecutor,
} from "../infrastructure/database/Database.js";

interface OutboxRow {
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  created_at: Date | string;
}

const eventTypes = new Set<string>(Object.values(EVENT_TYPES));

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new Error("pkg_outbox.get_pending_events returned an invalid payload");
}

function normalizeEvent(row: OutboxRow): DomainEvent {
  if (!eventTypes.has(row.event_type)) {
    throw new Error(`pkg_outbox.get_pending_events returned unsupported event: ${row.event_type}`);
  }
  return {
    eventId: row.event_id,
    eventType: row.event_type as EventType,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    occurredAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    payload: normalizePayload(row.payload),
  };
}

export class OutboxRepository implements OutboxRepositoryContract {
  constructor(private readonly database: RoutineExecutor = defaultDatabase) {}

  async pending(limit: number): Promise<DomainEvent[]> {
    const rows = await this.database.callFunction<OutboxRow>(
      DATABASE_ROUTINES.outbox.getPendingEvents,
      [limit],
    );
    return rows.map(normalizeEvent);
  }

  async markPublished(eventId: string): Promise<void> {
    await this.database.callProcedure(DATABASE_ROUTINES.outbox.markPublished, [eventId]);
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    await this.database.callProcedure(DATABASE_ROUTINES.outbox.markFailed, [eventId, error]);
  }

  async tryProcess(eventId: string, consumer: string): Promise<boolean> {
    const [row] = await this.database.callFunction<Record<string, boolean>>(
      DATABASE_ROUTINES.outbox.tryProcessEvent,
      [eventId, consumer],
    );
    return row ? Object.values(row)[0] === true : false;
  }
}

export function createOutboxRepository(database?: RoutineExecutor): OutboxRepository {
  return new OutboxRepository(database);
}
