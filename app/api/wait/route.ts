import { NextRequest, NextResponse } from "next/server";
import { calculateWait } from "@/lib/n8n-client";
import { waitQuerySchema } from "@/lib/plaza-schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = waitQuerySchema.safeParse({
    store_id: request.nextUrl.searchParams.get("store_id"),
    consult_type_id: request.nextUrl.searchParams.get("consult_type_id"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "매장과 상담 유형을 선택해주세요." },
      { status: 400 },
    );
  }

  try {
    const data = await calculateWait(
      parsed.data.store_id,
      parsed.data.consult_type_id,
    );

    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "맞춤 대기시간을 계산하지 못했습니다." },
      { status: 502 },
    );
  }
}

