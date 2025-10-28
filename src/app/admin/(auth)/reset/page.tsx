"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * يدعم:
 * - recovery: رابط يحوي #access_token/#refresh_token ⇒ setSession ثم إظهار نموذج تعيين كلمة المرور.
 * - magic link (?code=...): exchangeCodeForSession ثم توجيه مباشر إلى /admin.
 */
export default function ResetPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"recovery" | "magic" | null>(null);
  const [loading, setLoading] = useState(true);

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createSupabaseBrowser();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = window.location.href;

        // (1) حالة recovery: access_token + refresh_token داخل الـ hash
        if (url.includes("#")) {
          const hash = new URLSearchParams(url.split("#")[1]);
          const type = (hash.get("type") || "").toLowerCase();
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              console.error("setSession error:", error);
              if (!cancelled) {
                setMode(null);
                setLoading(false);
                setErrorMsg(error.message || "تعذر تفعيل الجلسة.");
              }
              return;
            }
            if (!cancelled) {
              if (type === "recovery") {
                setMode("recovery");
                setLoading(false);
              } else {
                setMode("magic");
                setLoading(false);
                const go = () => router.replace("/admin");
                go();
                setTimeout(go, 0);
                setTimeout(go, 150);
              }
            }
            return;
          }
        }

        // (2) حالة magic link: ?code=... ⇒ exchangeCodeForSession
        const u = new URL(url);
        if (u.searchParams.get("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.error("exchangeCodeForSession error:", error);
            if (!cancelled) {
              setMode(null);
              setLoading(false);
              setErrorMsg(error.message || "تعذر إتمام تسجيل الدخول.");
            }
            return;
          }
          if (!cancelled) {
            setMode("magic");
            setLoading(false);
            const go = () => router.replace("/admin");
            go();
            setTimeout(go, 0);
            setTimeout(go, 150);
          }
          return;
        }

        if (!cancelled) {
          setMode(null);
          setLoading(false);
          setErrorMsg(
            "الرابط غير صالح. افتح رابط الاستعادة من بريدك مرة أخرى."
          );
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setLoading(false);
          setMode(null);
          setErrorMsg("حدث خطأ غير متوقع.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // تحقق أساسي من القوة/التطابق (يمكن تشديده لاحقًا)
    if (newPass.length < 8) {
      setErrorMsg("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPass !== confirmPass) {
      setErrorMsg("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "تعذر تحديث كلمة المرور.");
      return;
    }

    // إشعار نجاح أنيق + تحويل إلى لوحة الإدارة
    setToast("تم تغيير كلمة المرور بنجاح.");
    // نسجّل الخروج من الجلسة المؤقتة ثم نرجّع مباشرة إلى /admin ليفتح مع البيانات الجديدة
    // (يمكن أيضًا توجيهك إلى /admin/login لو تفضل إعادة تسجيل الدخول يدويًا)
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace("/admin");
    }, 1000);
  };

  // ====== UI ======
  if (loading) return <div className="p-6">جاري التحقق…</div>;

  if (mode === "recovery") {
    return (
      <div className="min-h-[60vh] flex items-start justify-center pt-10 px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-lg font-bold mb-4">
            تعيين كلمة مرور جديدة
          </h1>

          {errorMsg ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 p-2 text-sm">
              {errorMsg}
            </div>
          ) : null}

          {toast ? (
            <div className="mb-3 rounded-md border border-green-200 bg-green-50 text-green-700 p-2 text-sm">
              {toast}
            </div>
          ) : null}

          <form onSubmit={onSetPassword} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500/40"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500/40"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
              />
            </div>

            <button
              className="w-full rounded bg-black text-white font-semibold py-2 disabled:opacity-50"
              disabled={loading}
            >
              حفظ
            </button>
          </form>
        </div>
      </div>
    );
  }

  // magic link أو حالة غير صالحة
  return (
    <div className="p-6 text-center">
      {errorMsg ? (
        <div className="mx-auto max-w-md rounded-md border border-red-200 bg-red-50 text-red-700 p-3">
          {errorMsg}
        </div>
      ) : (
        "تم تسجيل الدخول…"
      )}
    </div>
  );
}
