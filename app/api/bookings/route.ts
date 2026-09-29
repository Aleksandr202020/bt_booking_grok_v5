import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { endTimeOf, parseDateOnly, SLOT_TIMES } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** POST /api/bookings — confirm booking */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const dateStr = String(body.date || "");
    const startTime = String(body.time || "");
    const carId = String(body.carId || "");
    const sessionId = String(body.sessionId || "");
    const mainServiceId = String(body.mainServiceId || "");
    const extraServiceIds: string[] = Array.isArray(body.extraServiceIds)
      ? body.extraServiceIds.map(String)
      : [];

    if (!dateStr || !startTime || !carId || !mainServiceId || !sessionId) {
      return NextResponse.json(
        { ok: false, error: "Не хватает данных" },
        { status: 400 }
      );
    }

    if (!SLOT_TIMES.includes(startTime as (typeof SLOT_TIMES)[number])) {
      return NextResponse.json({ ok: false, error: "Неверное время" }, { status: 400 });
    }

    const date = parseDateOnly(dateStr);
    const endTime = endTimeOf(startTime);

    // Car must belong to user
    const car = await prisma.car.findFirst({
      where: { id: carId, userId: user.id, archived: false },
      include: {
        model: { include: { brand: true, category: true } },
      },
    });
    if (!car) {
      return NextResponse.json({ ok: false, error: "Автомобиль не найден" }, { status: 404 });
    }

    const categoryId = car.model.categoryId;

    // Services + prices for this category
    const serviceIds = [mainServiceId, ...extraServiceIds];
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, active: true },
      include: {
        prices: { where: { categoryId, active: true } },
      },
    });

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ ok: false, error: "Услуга не найдена" }, { status: 400 });
    }

    const main = services.find((s) => s.id === mainServiceId);
    if (!main || main.isExtra) {
      return NextResponse.json(
        { ok: false, error: "Выберите основную услугу" },
        { status: 400 }
      );
    }

    for (const s of services) {
      if (s.prices.length === 0) {
        return NextResponse.json(
          { ok: false, error: `Нет цены для ${s.nameRu}` },
          { status: 400 }
        );
      }
    }

    const totalPriceCents = services.reduce(
      (sum, s) => sum + s.prices[0].priceCents,
      0
    );

    // Atomic: check hold + free slot + create booking + delete hold
    const booking = await prisma.$transaction(async (tx) => {
      // Valid hold for this session
      const hold = await tx.slotHold.findFirst({
        where: {
          date,
          startTime,
          sessionId,
          expiresAt: { gt: new Date() },
        },
      });
      if (!hold) {
        throw new Error("HOLD_EXPIRED");
      }

      // Slot free of confirmed bookings
      const existing = await tx.booking.findFirst({
        where: { date, startTime, status: "CONFIRMED" },
      });
      if (existing) {
        throw new Error("SLOT_TAKEN");
      }

      // Not blocked
      const blocked = await tx.blockedSlot.findFirst({
        where: { date, startTime },
      });
      if (blocked) {
        throw new Error("SLOT_BLOCKED");
      }

      const closed = await tx.closedDay.findUnique({ where: { date } });
      if (closed) {
        throw new Error("DAY_CLOSED");
      }

      const created = await tx.booking.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          carId: car.id,
          date,
          startTime,
          endTime,
          status: "CONFIRMED",
          carBrandName: car.model.brand.name,
          carModelName: car.model.name,
          carCategoryName: car.model.category.nameRu,
          carCategorySlug: car.model.category.slug,
          totalPriceCents,
          services: {
            create: services.map((s) => ({
              id: crypto.randomUUID(),
              serviceId: s.id,
              serviceNameLv: s.nameLv,
              serviceNameRu: s.nameRu,
              serviceNameEn: s.nameEn,
              isExtra: s.isExtra,
              priceCents: s.prices[0].priceCents,
            })),
          },
        },
        include: { services: true },
      });

      // Release hold for this slot
      await tx.slotHold.deleteMany({
        where: { date, startTime },
      });

      await tx.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          action: "booking.create",
          entityType: "Booking",
          entityId: created.id,
          meta: {
            date: dateStr,
            startTime,
            totalPriceCents,
          },
        },
      });

      return created;
    });

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        date: dateStr,
        startTime: booking.startTime,
        endTime: booking.endTime,
        carBrandName: booking.carBrandName,
        carModelName: booking.carModelName,
        carCategoryName: booking.carCategoryName,
        totalPriceCents: booking.totalPriceCents,
        services: booking.services.map((s) => ({
          nameRu: s.serviceNameRu,
          isExtra: s.isExtra,
          priceCents: s.priceCents,
        })),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "HOLD_EXPIRED") {
      return NextResponse.json(
        { ok: false, error: "Время удержания истекло. Выберите слот снова." },
        { status: 409 }
      );
    }
    if (msg === "SLOT_TAKEN" || msg === "SLOT_BLOCKED" || msg === "DAY_CLOSED") {
      return NextResponse.json(
        { ok: false, error: "Слот уже занят или недоступен" },
        { status: 409 }
      );
    }
    // Unique constraint race
    if (msg.includes("Unique constraint") || msg.includes("unique_confirmed_slot")) {
      return NextResponse.json(
        { ok: false, error: "Слот только что заняли" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** GET /api/bookings — my bookings */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    include: { services: true },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    bookings: bookings.map((b) => ({
      id: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      carBrandName: b.carBrandName,
      carModelName: b.carModelName,
      totalPriceCents: b.totalPriceCents,
      services: b.services.map((s) => ({
        nameRu: s.serviceNameRu,
        priceCents: s.priceCents,
      })),
    })),
  });
}
