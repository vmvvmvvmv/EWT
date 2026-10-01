import { PlazaDashboard } from "@/components/plaza-dashboard";
import { getStores } from "@/lib/n8n-client";
import type { PlazaStore } from "@/lib/plaza-types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialStores: PlazaStore[] = [];
  let initialError = "";

  try {
    initialStores = (await getStores()).stores;
  } catch {
    initialError = "매장 현황을 불러오지 못했습니다. 새로고침을 눌러 다시 시도해주세요.";
  }

  return <PlazaDashboard initialStores={initialStores} initialError={initialError} />;
}

