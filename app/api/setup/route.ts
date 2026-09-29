import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { LV_CATALOG } from "../../../prisma/catalog-lv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    await prisma.$queryRaw`SELECT 1 FROM categories LIMIT 1`;
  } catch {
    await prisma.$disconnect();
    return NextResponse.json(
      {
        ok: false,
        error: "Tables not found. First run prisma/setup.sql in Neon SQL Editor.",
      },
      { status: 503 }
    );
  }

  try {
    const categories = [
      {
        slug: "light",
        nameLv: "Vieglā automašīna",
        nameRu: "Легковой автомобиль",
        nameEn: "Passenger car",
        sortOrder: 1,
      },
      {
        slug: "suv",
        nameLv: "Džips / krosovers / minivens",
        nameRu: "Джип / кроссовер / минивэн",
        nameEn: "SUV / crossover / minivan",
        sortOrder: 2,
      },
      {
        slug: "van",
        nameLv: "Minibuss / liels vans",
        nameRu: "Микроавтобус / большой фургон",
        nameEn: "Minibus / large van",
        sortOrder: 3,
      },
      {
        slug: "commercial",
        nameLv: "Commercial",
        nameRu: "Коммерческий автомобиль",
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

    const mainService = await prisma.service.upsert({
      where: { slug: "complex-wash" },
      update: {
        nameLv: "Kompleksā mazgāšana",
        nameRu: "Комплексная мойка",
        nameEn: "Complex wash",
        isExtra: false,
        active: true,
        sortOrder: 1,
      },
      create: {
        id: crypto.randomUUID(),
        slug: "complex-wash",
        nameLv: "Kompleksā mazgāšana",
        nameRu: "Комплексная мойка",
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
        nameLv: "Aromatizācija",
        nameRu: "Ароматизация",
        nameEn: "Aromatization",
        priceCents: 300,
        sortOrder: 10,
      },
      {
        slug: "tire-care",
        nameLv: "Riepu apstrāde",
        nameRu: "Обработка шин",
        nameEn: "Tire treatment",
        priceCents: 400,
        sortOrder: 11,
      },
      {
        slug: "leather",
        nameLv: "Ādas apstrāde",
        nameRu: "Обработка кожи",
        nameEn: "Leather treatment",
        priceCents: 400,
        sortOrder: 12,
      },
      {
        slug: "engine",
        nameLv: "Dzinēja mazgāšana",
        nameRu: "Мойка двигателя",
        nameEn: "Engine wash",
        priceCents: 1000,
        sortOrder: 13,
      },
      {
        slug: "rain",
        nameLv: "Pretlietus",
        nameRu: "Антидождь",
        nameEn: "Anti-rain",
        priceCents: 400,
        sortOrder: 14,
      },
      {
        slug: "rims",
        nameLv: "Disku mazgāšana",
        nameRu: "Мойка дисков",
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

    // Full Latvia catalog
    let sort = 1;
    for (const { brand: brandName, models } of LV_CATALOG) {
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

    const year = new Date().getFullYear();
    for (const [month, day, name] of [
      [6, 23, "Līgo"],
      [6, 24, "Jāņi"],
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
      message: "Seed complete (LV catalog)",
      counts,
    });
  } catch (error) {
    await prisma.$disconnect();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
