import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/services?categoryId=... — main + extra services with prices */
export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get("categoryId");
    if (!categoryId) {
      return NextResponse.json(
        { ok: false, error: "categoryId required" },
        { status: 400 }
      );
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        prices: {
          where: { categoryId, active: true },
        },
      },
    });

    const list = services
      .filter((s) => s.prices.length > 0)
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        nameLv: s.nameLv,
        nameRu: s.nameRu,
        nameEn: s.nameEn,
        isExtra: s.isExtra,
        priceCents: s.prices[0].priceCents,
      }));

    return NextResponse.json({
      ok: true,
      main: list.filter((s) => !s.isExtra),
      extras: list.filter((s) => s.isExtra),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
