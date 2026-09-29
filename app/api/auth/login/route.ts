import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  findUserByPhone,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!phone || !password) {
      return NextResponse.json(
        { ok: false, error: "Телефон и пароль обязательны" },
        { status: 400 }
      );
    }

    const user = await findUserByPhone(phone);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Неверный телефон или пароль" },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Неверный телефон или пароль" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
