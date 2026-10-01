import { z } from "zod";

export const waitSnapshotSchema = z
  .object({
    snapshot_id: z.string().optional(),
    calculated_at: z.string().optional(),
    consult_type_id: z.string().nullable().optional(),
    working_staff_count: z.number().optional(),
    active_consult_count: z.number().optional(),
    free_staff_now: z.number().optional(),
    waiting_count: z.number().optional(),
    reservation_count_60m: z.number().optional(),
    estimated_wait_point: z.number().optional(),
    estimated_wait_min: z.number().optional(),
    estimated_wait_max: z.number().optional(),
    calculation_scope: z.string().optional(),
  })
  .passthrough();

export const plazaStoreSchema = z
  .object({
    store_id: z.string().min(1),
    store_name: z.string().min(1),
    district: z.string(),
    address: z.string(),
    phone: z.string(),
    weekday_open: z.string(),
    weekday_close: z.string(),
    saturday_open: z.string(),
    saturday_close: z.string(),
    sunday_status: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    coordinate_status: z.string().optional(),
    latest_wait: waitSnapshotSchema.nullable(),
  })
  .passthrough();

export const storesResponseSchema = z.object({
  ok: z.boolean(),
  count: z.number().int().nonnegative(),
  stores: z.array(plazaStoreSchema),
});

export const waitQuerySchema = z.object({
  store_id: z.string().regex(/^ST\d{3}$/, "올바른 매장 ID가 아닙니다."),
  consult_type_id: z
    .string()
    .regex(/^(COMMON|CT\d{2})$/, "올바른 상담 유형이 아닙니다."),
});

export const queueRequestSchema = z.object({
  store_id: z.string().regex(/^ST\d{3}$/, "올바른 매장 ID가 아닙니다."),
  customer_id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CUS\d{4}$/, "고객번호는 CUS0102와 같은 형식이어야 합니다."),
  consult_type_id: z
    .string()
    .regex(/^CT\d{2}$/, "올바른 상담 유형이 아닙니다."),
});

export type QueueRequest = z.infer<typeof queueRequestSchema>;

