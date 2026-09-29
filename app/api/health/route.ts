import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [categories, services, brands, bookings] = await Promise.all([
      prisma.category.count(),
      prisma.service.count(),
      prisma.brand.count(),
      prisma.booking.count(),
    ]);

    return NextResponse.json({
      ok: true,
      database: "connected",
      counts: { categories, services, brands, bookings },
      time: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: message,
        hint:
          "Tables may not exist yet. Run: npx prisma db push && npm run db:seed",
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
