import { context, propagation, SpanStatusCode, trace, type Span } from '@opentelemetry/api';

/**
 * Tracing (ImBackendImplementationPlan P3-09, R-14). Code uses the OpenTelemetry API only; with no
 * provider registered every span is a no-op, so tests and the default local run pay nothing.
 * `startTracing()` registers a provider and exports over OTLP when OTEL_EXPORTER_OTLP_ENDPOINT is
 * set: the `obs` compose profile locally, the ADOT collector in AWS (X-11). One trace id follows a
 * request into its database spans, and P6 carries it on through the queue to the worker.
 */
export const tracer = trace.getTracer('nextkin-server');

export async function withSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** Runs `fn` inside the trace context carried by incoming headers (W3C traceparent). */
export function withIncomingContext<T>(headers: Headers, fn: () => T): T {
  const carrier: Record<string, string> = {};
  headers.forEach((value, key) => {
    carrier[key] = value;
  });
  return context.with(propagation.extract(context.active(), carrier), fn);
}

/** The active span's trace id, or null when tracing is off. */
export function activeTraceId(): string | null {
  const id = trace.getActiveSpan()?.spanContext().traceId;
  return id && !/^0+$/.test(id) ? id : null;
}

let started = false;

/** Registers the provider once per process. Safe to call when no endpoint is configured. */
export async function startTracing(serviceName: string, endpoint: string | undefined): Promise<void> {
  if (started || !endpoint) return;
  started = true;
  const [{ NodeTracerProvider }, { BatchSpanProcessor }, { OTLPTraceExporter }, { resourceFromAttributes }, { registerInstrumentations }, { PgInstrumentation }] =
    await Promise.all([
      import('@opentelemetry/sdk-trace-node'),
      import('@opentelemetry/sdk-trace-base'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/instrumentation-pg'),
    ]);
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }))],
  });
  provider.register();
  // Automatic pg spans where the driver can still be patched; the manual db spans cover the rest.
  registerInstrumentations({ instrumentations: [new PgInstrumentation({ enhancedDatabaseReporting: false })] });
}
