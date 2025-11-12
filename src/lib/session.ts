import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE = "sid";
const MAX_AGE = 60 * 60 * 24 * 365; // سنة

/** يولّد/يثبّت sid ويُرجعه. */
export async function ensureSessionId(): Promise<string> {
  const jar = await cookies(); // ← لازم await في Next 15 داخل libs
  let sid = jar.get(COOKIE)?.value;
  if (!sid) {
    sid = randomUUID();
    jar.set(COOKIE, sid, {
      httpOnly: false, // نحتاج نقرأه من الفرونت لو حبيت لاحقًا
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return sid;
}

/** يرجّع sid إن وُجد، وإلا null. */
export async function getExistingSessionId(): Promise<string | null> {
  const jar = await cookies(); // ← برضه await
  const sid = jar.get(COOKIE)?.value || null;
  return sid;
}
