import { serverConfig } from "@/lib/config";
import { storesResponseSchema, waitSnapshotSchema } from "@/lib/plaza-schemas";
import type { QueueRequest } from "@/lib/plaza-schemas";
import type { StoresResponse, WaitSnapshot } from "@/lib/plaza-types";

export class ExternalApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    serverConfig.n8n.timeoutMs,
  );

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ExternalApiError("외부 API가 JSON을 반환하지 않았습니다.", response.status);
      }
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String(payload.message)
          : `외부 API 오류 (${response.status})`;
      throw new ExternalApiError(message, response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ExternalApiError("외부 API 응답 시간이 초과되었습니다.");
    }
    throw new ExternalApiError("외부 API에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStores(): Promise<StoresResponse> {
  const payload = await requestJson<unknown>(serverConfig.n8n.storesUrl);
  return storesResponseSchema.parse(payload);
}

export async function calculateWait(
  storeId: string,
  consultTypeId: string,
): Promise<WaitSnapshot> {
  const params = new URLSearchParams({
    store_id: storeId,
    consult_type_id: consultTypeId,
    as_of: new Date().toISOString(),
  });
  const payload = await requestJson<{ ok?: boolean; data?: unknown }>(
    `${serverConfig.n8n.waitUrl}?${params.toString()}`,
  );
  if (payload.ok === false) {
    throw new ExternalApiError("대기시간 API가 계산에 실패했습니다.");
  }
  const data = payload?.data ?? payload;
  return waitSnapshotSchema.parse(data) as WaitSnapshot;
}

export async function registerQueue(input: QueueRequest): Promise<unknown> {
  return requestJson(serverConfig.n8n.queueRegisterUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      queued_at: new Date().toISOString(),
      priority_type: "NORMAL",
      input_source: "CUSTOMER_WEB",
    }),
  });
}

