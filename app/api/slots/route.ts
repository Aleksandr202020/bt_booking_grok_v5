import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredHolds, getSlotsForDate, nowInRiga, addDays } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** GET /api/slots?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  try {
    await cleanupExpiredHolds();

    const dateParam = req.nextUrl.searchParams.get("date");
    const { dateStr: today } = nowInRiga();
    const date = dateParam || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, error: "Invalid date, use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const result = await getSlotsForDate(date);

    return NextResponse.json({
      ok: true,
      today,
      maxDate: addDays(today, 30),
      timezone: "Europe/Riga",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
