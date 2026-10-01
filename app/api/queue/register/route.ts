import { NextRequest, NextResponse } from "next/server";
import { registerQueue } from "@/lib/n8n-client";
import { queueRequestSchema } from "@/lib/plaza-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = queueRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "매장, 고객번호, 상담 업무를 확인해주세요." },
        { status: 400 },
      );
    }

    return NextResponse.json(await registerQueue(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, message: "요청 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "대기 접수 서버에 연결하지 못했습니다." },
      { status: 502 },
    );
  }
}
