import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/cars — my cars */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  const cars = await prisma.car.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { createdAt: "desc" },
    include: {
      model: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    cars: cars.map((c) => ({
      id: c.id,
      plate: c.plate,
      brandName: c.model.brand.name,
      modelName: c.model.name,
      modelId: c.modelId,
      category: c.model.category,
    })),
  });
}

/** POST /api/cars — add car { modelId, plate? } */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const modelId = String(body.modelId || "");
    const plate = body.plate ? String(body.plate).trim() : null;

    if (!modelId) {
      return NextResponse.json({ ok: false, error: "Выберите модель" }, { status: 400 });
    }

    const model = await prisma.model.findFirst({
      where: { id: modelId, active: true },
      include: { brand: true, category: true },
    });
    if (!model) {
      return NextResponse.json({ ok: false, error: "Модель не найдена" }, { status: 404 });
    }

    const car = await prisma.car.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        modelId,
        plate,
      },
    });

    return NextResponse.json({
      ok: true,
      car: {
        id: car.id,
        plate: car.plate,
        brandName: model.brand.name,
        modelName: model.name,
        modelId: model.id,
        category: model.category,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
