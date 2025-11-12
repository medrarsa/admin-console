import { NextResponse } from "next/server";

/**
 * Endpoint بسيط مؤقتًا حتى يمرّ الـ build.
 * لاحقًا نقدر نربطه بقاعدة البيانات (list/create) حسب اللي تحتاجه.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
