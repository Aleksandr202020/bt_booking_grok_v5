import { NextRequest, NextResponse } from "next/server";
import { releaseHold } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** POST /api/slots/release  { sessionId, date?, time? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body.sessionId as string | undefined;

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    await releaseHold(sessionId, body.date, body.time);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
