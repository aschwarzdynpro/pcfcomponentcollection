/**
 * Lightweight, dependency-free telemetry for the control. Structured events go
 * to the PCF diagnostic trace (`context.tracing`) and the browser console, both
 * guarded so logging can never break the control. The focus is the destructive
 * operations (split-save delete, delivery-note creation) so a failure leaves a
 * trail of which step it reached.
 */

const SRC = "WorkTimeSplitGrid";

/** Minimal shape of the PCF diagnostic trace service (context.tracing). */
export interface TracingService {
    trace(message: string, ...optionalParams: unknown[]): void;
}

export type LogData = Record<string, unknown>;

/** One buffered telemetry line (for the in-control debug/info panel). */
export interface LogEntry {
    /** ISO timestamp when the event was emitted. */
    time: string;
    level: string;
    name: string;
    data?: LogData;
}

/** Max lines kept in the in-memory ring buffer (oldest dropped past this). */
const BUFFER_MAX = 200;

export interface Op {
    /** Log a progress step within the operation (with elapsed ms). */
    step(name: string, data?: LogData): void;
    /** Log successful completion (with total elapsed ms). */
    ok(data?: LogData): void;
    /** Log failure (with elapsed ms + error details). */
    fail(error: unknown, data?: LogData): void;
}

export interface Logger {
    event(name: string, data?: LogData): void;
    warn(name: string, data?: LogData): void;
    error(name: string, error: unknown, data?: LogData): void;
    /** Start a timed operation; call step()/ok()/fail() for its lifecycle. */
    op(name: string, data?: LogData): Op;
    /** Recent buffered events (newest last) — for the in-control debug panel. */
    snapshot(): LogEntry[];
}

/** Normalize an unknown thrown value into loggable fields. */
export function errorData(error: unknown): LogData {
    if (error instanceof Error) {
        return { error: error.message, stack: error.stack };
    }
    if (error && typeof error === "object") {
        const e = error as { message?: string; code?: string };
        return {
            error: String(e.message ?? safeStringify(error)),
            ...(e.code ? { code: e.code } : {}),
        };
    }
    return { error: String(error) };
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function createLogger(tracing?: TracingService): Logger {
    const buffer: LogEntry[] = [];
    const emit = (level: string, name: string, data?: LogData): void => {
        const payload = data ? safeStringify(data) : "";
        // Keep a bounded in-memory trail so the debug panel can surface it.
        try {
            buffer.push({ time: new Date().toISOString(), level, name, data });
            if (buffer.length > BUFFER_MAX) buffer.shift();
        } catch {
            /* never let buffering break the control */
        }
        try {
            tracing?.trace(`[${SRC}] ${level} ${name} ${payload}`);
        } catch {
            /* tracing unavailable — ignore */
        }
        try {
            const fn =
                level === "error"
                    ? console.error
                    : level === "warn"
                      ? console.warn
                      : console.info;
            fn(`[${SRC}] ${name}`, data ?? "");
        } catch {
            /* console unavailable — ignore */
        }
    };

    return {
        event: (name, data) => emit("info", name, data),
        warn: (name, data) => emit("warn", name, data),
        error: (name, error, data) =>
            emit("error", name, { ...errorData(error), ...(data ?? {}) }),
        op: (name, data) => {
            const start = Date.now();
            emit("info", `${name}.start`, data);
            const elapsed = (): LogData => ({ ms: Date.now() - start });
            return {
                step: (s, d) =>
                    emit("info", `${name}.${s}`, { ...elapsed(), ...(d ?? {}) }),
                ok: (d) => emit("info", `${name}.ok`, { ...elapsed(), ...(d ?? {}) }),
                fail: (error, d) =>
                    emit("error", `${name}.fail`, {
                        ...elapsed(),
                        ...errorData(error),
                        ...(d ?? {}),
                    }),
            };
        },
        snapshot: () => buffer.slice(),
    };
}

/** No-op logger (default when none is provided). */
export const NOOP_LOGGER: Logger = {
    event: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    op: () => ({
        step: () => undefined,
        ok: () => undefined,
        fail: () => undefined,
    }),
    snapshot: () => [],
};
