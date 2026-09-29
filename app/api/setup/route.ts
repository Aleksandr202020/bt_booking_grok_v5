import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-time setup from phone browser.
 * GET /api/setup?secret=YOUR_SECRET
 *
 * Set SETUP_SECRET in Vercel Environment Variables first.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.SETUP_SECRET;

  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SETUP_SECRET not set. Add it in Vercel → Settings → Environment Variables",
      },
      { status: 500 }
    );
  }

  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid secret" }, { status: 401 });
  }

  const prisma = new PrismaClient();

  try {
    // Check tables exist
    await prisma.$queryRaw`SELECT 1 FROM categories LIMIT 1`;
  } catch {
    await prisma.$disconnect();
    return NextResponse.json(
      {
        ok: false,
        error: "Tables not found. First run prisma/setup.sql in Neon SQL Editor.",
        steps: [
          "1. Open https://console.neon.tech",
          "2. Open your project → SQL Editor",
          "3. Paste contents of prisma/setup.sql and Run",
          "4. Then open this URL again",
        ],
      },
      { status: 503 }
    );
  }

  try {
    // ── Categories ──
    const categories = [
      {
        slug: "light",
        nameLv: "Viegl\u0101 automa\u0161\u012bna",
        nameRu: "\u041b\u0435\u0433\u043a\u043e\u0432\u043e\u0439 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c",
        nameEn: "Passenger car",
        sortOrder: 1,
      },
      {
        slug: "suv",
        nameLv: "D\u017eips / krosovers / minivens",
        nameRu: "\u0414\u0436\u0438\u043f / \u043a\u0440\u043e\u0441\u0441\u043e\u0432\u0435\u0440 / \u043c\u0438\u043d\u0438\u0432\u044d\u043d",
        nameEn: "SUV / crossover / minivan",
        sortOrder: 2,
      },
      {
        slug: "van",
        nameLv: "Minibuss / liels vans",
        nameRu: "\u041c\u0438\u043a\u0440\u043e\u0430\u0432\u0442\u043e\u0431\u0443\u0441 / \u0431\u043e\u043b\u044c\u0448\u043e\u0439 \u0444\u0443\u0440\u0433\u043e\u043d",
        nameEn: "Minibus / large van",
        sortOrder: 3,
      },
      {
        slug: "commercial",
        nameLv: "Commercial",
        nameRu: "\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u0438\u0439 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c",
        nameEn: "Commercial",
        sortOrder: 4,
      },
    ];

    for (const c of categories) {
      await prisma.category.upsert({
        where: { slug: c.slug },
        update: c,
        create: { id: crypto.randomUUID(), ...c },
      });
    }

    const catRows = await prisma.category.findMany();
    const cat = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

    // ── Main service ──
    const mainService = await prisma.service.upsert({
      where: { slug: "complex-wash" },
      update: {
        nameLv: "Kompleks\u0101 mazg\u0101\u0161ana",
        nameRu: "\u041a\u043e\u043c\u043f\u043b\u0435\u043a\u0441\u043d\u0430\u044f \u043c\u043e\u0439\u043a\u0430",
        nameEn: "Complex wash",
        isExtra: false,
        active: true,
        sortOrder: 1,
      },
      create: {
        id: crypto.randomUUID(),
        slug: "complex-wash",
        nameLv: "Kompleks\u0101 mazg\u0101\u0161ana",
        nameRu: "\u041a\u043e\u043c\u043f\u043b\u0435\u043a\u0441\u043d\u0430\u044f \u043c\u043e\u0439\u043a\u0430",
        nameEn: "Complex wash",
        isExtra: false,
        active: true,
        sortOrder: 1,
      },
    });

    const mainPrices: Record<string, number> = {
      light: 2500,
      suv: 3000,
      van: 3500,
      commercial: 3500,
    };

    for (const [slug, priceCents] of Object.entries(mainPrices)) {
      await prisma.servicePrice.upsert({
        where: {
          serviceId_categoryId: {
            serviceId: mainService.id,
            categoryId: cat[slug],
          },
        },
        update: { priceCents, active: true },
        create: {
          id: crypto.randomUUID(),
          serviceId: mainService.id,
          categoryId: cat[slug],
          priceCents,
          active: true,
        },
      });
    }

    const extras = [
      {
        slug: "aroma",
        nameLv: "Aromatiz\u0101cija",
        nameRu: "\u0410\u0440\u043e\u043c\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044f",
        nameEn: "Aromatization",
        priceCents: 300,
        sortOrder: 10,
      },
      {
        slug: "tire-care",
        nameLv: "Riepu apstr\u0101de",
        nameRu: "\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u0448\u0438\u043d",
        nameEn: "Tire treatment",
        priceCents: 400,
        sortOrder: 11,
      },
      {
        slug: "leather",
        nameLv: "\u0100das apstr\u0101de",
        nameRu: "\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u043a\u043e\u0436\u0438",
        nameEn: "Leather treatment",
        priceCents: 400,
        sortOrder: 12,
      },
      {
        slug: "engine",
        nameLv: "Dzin\u0113ja mazg\u0101\u0161ana",
        nameRu: "\u041c\u043e\u0439\u043a\u0430 \u0434\u0432\u0438\u0433\u0430\u0442\u0435\u043b\u044f",
        nameEn: "Engine wash",
        priceCents: 1000,
        sortOrder: 13,
      },
      {
        slug: "rain",
        nameLv: "Pretlietus",
        nameRu: "\u0410\u043d\u0442\u0438\u0434\u043e\u0436\u0434\u044c",
        nameEn: "Anti-rain",
        priceCents: 400,
        sortOrder: 14,
      },
      {
        slug: "rims",
        nameLv: "Disku mazg\u0101\u0161ana",
        nameRu: "\u041c\u043e\u0439\u043a\u0430 \u0434\u0438\u0441\u043a\u043e\u0432",
        nameEn: "Rim wash",
        priceCents: 400,
        sortOrder: 15,
      },
    ];

    for (const e of extras) {
      const service = await prisma.service.upsert({
        where: { slug: e.slug },
        update: {
          nameLv: e.nameLv,
          nameRu: e.nameRu,
          nameEn: e.nameEn,
          isExtra: true,
          active: true,
          sortOrder: e.sortOrder,
        },
        create: {
          id: crypto.randomUUID(),
          slug: e.slug,
          nameLv: e.nameLv,
          nameRu: e.nameRu,
          nameEn: e.nameEn,
          isExtra: true,
          active: true,
          sortOrder: e.sortOrder,
        },
      });

      for (const categoryId of Object.values(cat)) {
        await prisma.servicePrice.upsert({
          where: {
            serviceId_categoryId: {
              serviceId: service.id,
              categoryId,
            },
          },
          update: { priceCents: e.priceCents, active: true },
          create: {
            id: crypto.randomUUID(),
            serviceId: service.id,
            categoryId,
            priceCents: e.priceCents,
            active: true,
          },
        });
      }
    }

    // ── Brands ──
    const brandModels: {
      brand: string;
      models: { name: string; cat: string }[];
    }[] = [
      {
        brand: "BMW",
        models: [
          { name: "330d", cat: "light" },
          { name: "X5", cat: "suv" },
          { name: "X3", cat: "suv" },
        ],
      },
      {
        brand: "\u0160koda",
        models: [
          { name: "Kamiq", cat: "suv" },
          { name: "Octavia", cat: "light" },
          { name: "Superb", cat: "light" },
        ],
      },
      {
        brand: "Mercedes-Benz",
        models: [
          { name: "V-Class", cat: "van" },
          { name: "C-Class", cat: "light" },
          { name: "GLC", cat: "suv" },
        ],
      },
      {
        brand: "Volkswagen",
        models: [
          { name: "Golf", cat: "light" },
          { name: "Tiguan", cat: "suv" },
          { name: "Transporter", cat: "van" },
        ],
      },
      {
        brand: "Toyota",
        models: [
          { name: "Corolla", cat: "light" },
          { name: "RAV4", cat: "suv" },
          { name: "Yaris", cat: "light" },
        ],
      },
      {
        brand: "Audi",
        models: [
          { name: "A4", cat: "light" },
          { name: "Q5", cat: "suv" },
        ],
      },
      {
        brand: "Volvo",
        models: [
          { name: "XC60", cat: "suv" },
          { name: "S60", cat: "light" },
        ],
      },
      {
        brand: "Ford",
        models: [
          { name: "Focus", cat: "light" },
          { name: "Kuga", cat: "suv" },
          { name: "Transit", cat: "van" },
        ],
      },
    ];

    let sort = 1;
    for (const { brand: brandName, models } of brandModels) {
      const brand = await prisma.brand.upsert({
        where: { name: brandName },
        update: { active: true, sortOrder: sort },
        create: {
          id: crypto.randomUUID(),
          name: brandName,
          active: true,
          sortOrder: sort,
        },
      });
      sort++;

      for (const m of models) {
        await prisma.model.upsert({
          where: {
            brandId_name: { brandId: brand.id, name: m.name },
          },
          update: { categoryId: cat[m.cat], active: true },
          create: {
            id: crypto.randomUUID(),
            brandId: brand.id,
            name: m.name,
            categoryId: cat[m.cat],
            active: true,
          },
        });
      }
    }

    // Closed days
    const year = new Date().getFullYear();
    for (const [month, day, name] of [
      [6, 23, "L\u012bgo"],
      [6, 24, "J\u0101\u0146i"],
    ] as const) {
      const date = new Date(Date.UTC(year, month - 1, day));
      await prisma.closedDay.upsert({
        where: { date },
        update: { name },
        create: { id: crypto.randomUUID(), date, name },
      });
    }

    const counts = {
      categories: await prisma.category.count(),
      services: await prisma.service.count(),
      brands: await prisma.brand.count(),
      models: await prisma.model.count(),
    };

    await prisma.$disconnect();

    return NextResponse.json({
      ok: true,
      message: "Seed complete",
      counts,
    });
  } catch (error) {
    await prisma.$disconnect();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
