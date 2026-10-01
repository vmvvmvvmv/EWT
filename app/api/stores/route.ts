import { NextResponse } from "next/server";
import { getStores } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStores(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, count: 0, stores: [], message: "매장 정보를 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}

