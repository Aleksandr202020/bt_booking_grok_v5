import { NextRequest, NextResponse } from "next/server";
import { createHold, cleanupExpiredHolds } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** POST /api/slots/hold  { date, time, sessionId } */
export async function POST(req: NextRequest) {
  try {
    await cleanupExpiredHolds();

    const body = await req.json();
    const date = body.date as string | undefined;
    const time = body.time as string | undefined;
    const sessionId = body.sessionId as string | undefined;

    if (!date || !time || !sessionId) {
      return NextResponse.json(
        { ok: false, error: "date, time and sessionId are required" },
        { status: 400 }
      );
    }

    const result = await createHold({
      dateStr: date,
      startTime: time,
      sessionId,
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
