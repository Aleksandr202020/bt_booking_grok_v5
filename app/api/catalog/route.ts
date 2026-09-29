import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/catalog — brands, models, categories for booking */
export async function GET() {
  try {
    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          models: {
            where: { active: true },
            orderBy: { name: "asc" },
            include: {
              category: {
                select: {
                  id: true,
                  slug: true,
                  nameLv: true,
                  nameRu: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        models: b.models.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
        })),
      })),
      categories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
