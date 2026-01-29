import { z } from 'zod';

export function parseDbJson<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: string,
  opts: { field?: string } = {}
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (err) {
    const field = opts.field ?? 'json';
    throw new Error(`Invalid JSON in ${field}: ${(err as Error).message}`);
  }

  const r = schema.safeParse(parsed);
  if (!r.success) {
    const field = opts.field ?? 'json';
    throw new Error(`Invalid value in ${field}: ${r.error.message}`);
  }
  return r.data;
}

export function parseDbJsonNullable<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: string | null,
  opts: { field?: string } = {}
): T | null {
  if (value === null) return null;
  return parseDbJson(schema, value, opts);
}

export function serializeDbJson<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: T,
  opts: { field?: string } = {}
): string {
  const r = schema.safeParse(value);
  if (!r.success) {
    const field = opts.field ?? 'json';
    throw new Error(`Invalid value in ${field}: ${r.error.message}`);
  }
  return JSON.stringify(r.data);
}

export function serializeDbJsonNullable<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: T | null,
  opts: { field?: string } = {}
): string | null {
  if (value === null) return null;
  return serializeDbJson(schema, value, opts);
}

export const httpHeadersJsonSchema = z.record(z.string());
export type HttpHeadersJson = z.infer<typeof httpHeadersJsonSchema>;

export const expectedStatusJsonSchema = z.array(z.number().int().min(100).max(599)).min(1);
export type ExpectedStatusJson = z.infer<typeof expectedStatusJsonSchema>;

export const webhookSigningSchema = z.object({
  enabled: z.boolean(),
  secret_ref: z.string().min(1),
});

const webhookUrlSchema = z
  .string()
  .url()
  .refine((val) => {
    try {
      const url = new URL(val);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'url protocol must be http or https');

export const webhookChannelConfigSchema = z.object({
  url: webhookUrlSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  timeout_ms: z.number().int().min(1).max(60000).optional(),
  payload_type: z.enum(['json']).default('json'),
  signing: webhookSigningSchema.optional(),
});
export type WebhookChannelConfig = z.infer<typeof webhookChannelConfigSchema>;
