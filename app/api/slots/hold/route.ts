import { NextRequest, NextResponse } from "next/server";
import { createHold, cleanupExpiredHolds } from "@/lib/slots";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/slots/hold — only authenticated users */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Войдите в аккаунт, чтобы выбрать время", needAuth: true },
        { status: 401 }
      );
    }

    await cleanupExpiredHolds();

    const body = await req.json();
    const date = body.date as string | undefined;
    const time = body.time as string | undefined;
    const sessionId = (body.sessionId as string | undefined) || user.id;

    if (!date || !time) {
      return NextResponse.json(
        { ok: false, error: "date and time are required" },
        { status: 400 }
      );
    }

    const result = await createHold({
      dateStr: date,
      startTime: time,
      sessionId,
      userId: user.id,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      date,
      time,
      expiresAt: result.expiresAt,
      holdMinutes: 10,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
