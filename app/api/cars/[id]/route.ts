import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** DELETE /api/cars/[id] — soft archive if used in bookings */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const car = await prisma.car.findFirst({
    where: { id, userId: user.id },
  });
  if (!car) {
    return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 });
  }

  const used = await prisma.booking.count({ where: { carId: id } });
  if (used > 0) {
    await prisma.car.update({
      where: { id },
      data: { archived: true },
    });
  } else {
    await prisma.car.delete({ where: { id } });
  }

  return NextResponse.json({ ok: true });
}
