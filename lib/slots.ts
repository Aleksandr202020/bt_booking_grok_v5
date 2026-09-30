import { prisma } from "@/lib/db";

export const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
] as const;

export type SlotStatus = "free" | "busy" | "held" | "blocked" | "past" | "closed";

export type SlotInfo = {
  time: string;
  endTime: string;
  status: SlotStatus;
  holdExpiresAt?: string;
  holdSessionId?: string;
};

const HOLD_MINUTES = 10;
const MAX_DAYS_AHEAD = 30;
const TZ = "Europe/Riga";

export function nowInRiga(): { dateStr: string; timeStr: string; date: Date } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const timeStr = `${hour}:${parts.minute}`;
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  return { dateStr, timeStr, date };
}

export function parseDateOnly(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Invalid date format, use YYYY-MM-DD");
  }
  return new Date(`${dateStr}T12:00:00.000Z`);
}

export function endTimeOf(start: string): string {
  const [h, m] = start.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getSlotsForDate(dateStr: string): Promise<{
  date: string;
  closed: boolean;
  closedName: string | null;
  slots: SlotInfo[];
}> {
  const { dateStr: today, timeStr: nowTime } = nowInRiga();
  const maxDate = addDays(today, MAX_DAYS_AHEAD);

  if (dateStr < today || dateStr > maxDate) {
    return {
      date: dateStr,
      closed: true,
      closedName: null,
      slots: SLOT_TIMES.map((time) => ({
        time,
        endTime: endTimeOf(time),
        status: "past" as const,
      })),
    };
  }

  const date = parseDateOnly(dateStr);

  const [closedDay, bookings, holds, blocked] = await Promise.all([
    prisma.closedDay.findUnique({ where: { date } }),
    prisma.booking.findMany({
      where: { date, status: "CONFIRMED" },
      select: { startTime: true },
    }),
    prisma.slotHold.findMany({
      where: { date, expiresAt: { gt: new Date() } },
      select: { startTime: true, expiresAt: true, sessionId: true },
    }),
    prisma.blockedSlot.findMany({
      where: { date },
      select: { startTime: true },
    }),
  ]);

  if (closedDay) {
    return {
      date: dateStr,
      closed: true,
      closedName: closedDay.name,
      slots: SLOT_TIMES.map((time) => ({
        time,
        endTime: endTimeOf(time),
        status: "closed" as const,
      })),
    };
  }

  const busy = new Set(bookings.map((b) => b.startTime));
  const holdByTime = new Map(
    holds.map((h) => [
      h.startTime,
      { expiresAt: h.expiresAt.toISOString(), sessionId: h.sessionId },
    ])
  );
  const blockedSet = new Set(blocked.map((b) => b.startTime));

  const slots: SlotInfo[] = SLOT_TIMES.map((time) => {
    let status: SlotStatus = "free";
    let holdExpiresAt: string | undefined;
    let holdSessionId: string | undefined;

    if (dateStr === today && time <= nowTime) {
      status = "past";
    } else if (busy.has(time)) {
      status = "busy";
    } else if (blockedSet.has(time)) {
      status = "blocked";
    } else if (holdByTime.has(time)) {
      status = "held";
      const h = holdByTime.get(time)!;
      holdExpiresAt = h.expiresAt;
      holdSessionId = h.sessionId;
    }

    return {
      time,
      endTime: endTimeOf(time),
      status,
      holdExpiresAt,
      holdSessionId,
    };
  });

  return { date: dateStr, closed: false, closedName: null, slots };
}

/** Hold requires authenticated userId */
export async function createHold(params: {
  dateStr: string;
  startTime: string;
  sessionId: string;
  userId: string;
}): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }> {
  const { dateStr, startTime, sessionId, userId } = params;

  if (!userId) {
    return { ok: false, error: "Auth required" };
  }

  if (!SLOT_TIMES.includes(startTime as (typeof SLOT_TIMES)[number])) {
    return { ok: false, error: "Invalid time slot" };
  }

  const info = await getSlotsForDate(dateStr);
  if (info.closed) {
    return { ok: false, error: "This day is closed" };
  }

  const slot = info.slots.find((s) => s.time === startTime);
  if (!slot || slot.status !== "free") {
    const existing = await prisma.slotHold.findFirst({
      where: {
        date: parseDateOnly(dateStr),
        startTime,
        userId,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return { ok: true, expiresAt: existing.expiresAt.toISOString() };
    }
    return { ok: false, error: "Slot is not available" };
  }

  const date = parseDateOnly(dateStr);
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

  // One active hold per user
  await prisma.slotHold.deleteMany({
    where: { userId, NOT: { date, startTime } },
  });
  await prisma.slotHold.deleteMany({
    where: { sessionId, NOT: { date, startTime } },
  });

  try {
    await prisma.slotHold.deleteMany({
      where: { date, startTime, expiresAt: { lte: new Date() } },
    });

    const hold = await prisma.slotHold.upsert({
      where: {
        date_startTime: { date, startTime },
      },
      update: {
        sessionId,
        userId,
        expiresAt,
      },
      create: {
        id: crypto.randomUUID(),
        date,
        startTime,
        sessionId,
        userId,
        expiresAt,
      },
    });

    return { ok: true, expiresAt: hold.expiresAt.toISOString() };
  } catch {
    return { ok: false, error: "Slot was just taken" };
  }
}

export async function releaseHold(
  sessionId: string,
  dateStr?: string,
  startTime?: string
) {
  if (dateStr && startTime) {
    await prisma.slotHold.deleteMany({
      where: {
        sessionId,
        date: parseDateOnly(dateStr),
        startTime,
      },
    });
  } else {
    await prisma.slotHold.deleteMany({ where: { sessionId } });
  }
}

export async function cleanupExpiredHolds() {
  await prisma.slotHold.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
}
