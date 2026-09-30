import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CANCEL_MIN_HOURS_BEFORE } from "@/lib/limits";
import { nowInRiga, parseDateOnly } from "@/lib/slots";

export const dynamic = "force-dynamic";

function slotStartUtcApprox(dateStr: string, startTime: string): Date {
  // Treat Europe/Riga as UTC+3 in summer / +2 winter roughly via Intl
  const { dateStr: today, timeStr } = nowInRiga();
  // Build ISO in Riga: use noon date + time offset from Riga local via formatter inverse is hard;
  // Approximate: get current Riga offset from a known instant
  const probe = new Date();
  const rigaParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Riga",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tzName = rigaParts.find((p) => p.type === "timeZoneName")?.value || "GMT+3";
  const m = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
  let offsetMin = 180;
  if (m) {
    const h = Number(m[1]);
    const mins = m[2] ? Number(m[2]) : 0;
    offsetMin = h * 60 + (h < 0 ? -mins : mins);
  }
  const [hh, mm] = startTime.split(":").map(Number);
  // UTC = local - offset
  const utcMs =
    Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      hh,
      mm,
      0
    ) -
    offsetMin * 60 * 1000;
  return new Date(utcMs);
}

/** DELETE /api/bookings/[id] — cancel own booking */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const booking = await prisma.booking.findFirst({
    where: { id, userId: user.id },
  });

  if (!booking) {
    return NextResponse.json({ ok: false, error: "Запись не найдена" }, { status: 404 });
  }

  if (booking.status !== "CONFIRMED") {
    return NextResponse.json(
      { ok: false, error: "Эту запись нельзя отменить" },
      { status: 400 }
    );
  }

  const dateStr = booking.date.toISOString().slice(0, 10);
  const start = slotStartUtcApprox(dateStr, booking.startTime);
  const hoursLeft = (start.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursLeft < CANCEL_MIN_HOURS_BEFORE) {
    return NextResponse.json(
      {
        ok: false,
        error: `Отмена возможна не позднее чем за ${CANCEL_MIN_HOURS_BEFORE} ч до начала`,
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        action: "booking.cancel",
        entityType: "Booking",
        entityId: id,
        meta: { date: dateStr, startTime: booking.startTime },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
