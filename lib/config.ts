const DEFAULT_N8N_BASE_URL =
  "https://ldhyb62.app.n8n.cloud/webhook/gs/kt";

export const serverConfig = {
  n8n: {
    storesUrl:
      process.env.N8N_STORES_API ?? `${DEFAULT_N8N_BASE_URL}/stores/wait-status`,
    waitUrl:
      process.env.N8N_WAIT_API ?? `${DEFAULT_N8N_BASE_URL}/calculate-wait`,
    queueRegisterUrl:
      process.env.N8N_QUEUE_REGISTER_API ??
      `${DEFAULT_N8N_BASE_URL}/queue/register`,
    timeoutMs: Number(process.env.N8N_API_TIMEOUT_MS ?? 10000),
  },
} as const;

