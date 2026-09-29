import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  normalizePhone,
  setSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const phoneRaw = String(body.phone || "").trim();
    const password = String(body.password || "");
    const email = body.email ? String(body.email).trim() : null;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Укажите имя" },
        { status: 400 }
      );
    }
    if (!phoneRaw) {
      return NextResponse.json(
        { ok: false, error: "Укажите телефон" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, error: "Пароль минимум 4 символа" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(phoneRaw);
    if (phone.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Некорректный телефон" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Этот телефон уже зарегистрирован" },
        { status: 409 }
      );
    }

    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        return NextResponse.json(
          { ok: false, error: "Этот email уже используется" },
          { status: 409 }
        );
      }
    }

    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        phone,
        email: email || null,
        password: await hashPassword(password),
        role: "CLIENT",
      },
    });

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
