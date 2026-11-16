"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";

type Section = {
  id: string;
  icon: string;
  titleKey: TKey;
  admin?: boolean; // true = เห็นเฉพาะ Admin
  numbered?: boolean; // ค่าเริ่มต้น true
  stepKeys: TKey[];
  tipKeys?: TKey[];
};

const SECTIONS: Section[] = [
  {
    id: "start",
    icon: "🔐",
    titleKey: "manual.start.title",
    stepKeys: [
      "manual.start.step1",
      "manual.start.step2",
      "manual.start.step3",
    ],
    tipKeys: ["manual.start.tip1"],
  },
  {
    id: "pos",
    icon: "🛒",
    titleKey: "manual.pos.title",
    stepKeys: [
      "manual.pos.step1",
      "manual.pos.step2",
      "manual.pos.step3",
      "manual.pos.step4",
      "manual.pos.step5",
      "manual.pos.step6",
      "manual.pos.step7",
    ],
    tipKeys: [
      "manual.pos.tip1",
      "manual.pos.tip2",
      "manual.pos.tip3",
    ],
  },
  {
    id: "inventory",
    icon: "📦",
    titleKey: "manual.inventory.title",
    admin: true,
    stepKeys: [
      "manual.inventory.step1",
      "manual.inventory.step2",
      "manual.inventory.step3",
      "manual.inventory.step4",
      "manual.inventory.step5",
      "manual.inventory.step6",
      "manual.inventory.step7",
    ],
    tipKeys: ["manual.inventory.tip1"],
  },
  {
    id: "categories",
    icon: "🏷️",
    titleKey: "manual.categories.title",
    admin: true,
    stepKeys: [
      "manual.categories.step1",
      "manual.categories.step2",
      "manual.categories.step3",
      "manual.categories.step4",
    ],
    tipKeys: ["manual.categories.tip1"],
  },
  {
    id: "dashboard",
    icon: "📊",
    titleKey: "manual.dashboard.title",
    admin: true,
    stepKeys: [
      "manual.dashboard.step1",
      "manual.dashboard.step2",
      "manual.dashboard.step3",
      "manual.dashboard.step4",
      "manual.dashboard.step5",
    ],
    tipKeys: ["manual.dashboard.tip1"],
  },
  {
    id: "ai",
    icon: "🤖",
    titleKey: "manual.ai.title",
    admin: true,
    stepKeys: [
      "manual.ai.step1",
      "manual.ai.step2",
      "manual.ai.step3",
      "manual.ai.step4",
    ],
    tipKeys: [
      "manual.ai.tip1",
      "manual.ai.tip2",
    ],
  },
  {
    id: "history",
    icon: "📋",
    titleKey: "manual.history.title",
    admin: true,
    stepKeys: [
      "manual.history.step1",
      "manual.history.step2",
    ],
  },
  {
    id: "users",
    icon: "👥",
    titleKey: "manual.users.title",
    admin: true,
    stepKeys: [
      "manual.users.step1",
      "manual.users.step2",
      "manual.users.step3",
    ],
  },
  {
    id: "troubleshooting",
    icon: "🛠️",
    titleKey: "manual.troubleshooting.title",
    numbered: false,
    stepKeys: [
      "manual.troubleshooting.step1",
      "manual.troubleshooting.step2",
      "manual.troubleshooting.step3",
      "manual.troubleshooting.step4",
      "manual.troubleshooting.step5",
    ],
  },
];

export default function ManualPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole((profile?.role ?? "cashier").toLowerCase());
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = role === "admin";
  const q = query.trim().toLowerCase();

  const visible = SECTIONS.filter((s) => isAdmin || !s.admin).filter(
    (s) =>
      q === "" ||
      [
        t(s.titleKey),
        ...(s.admin ? [t("manual.adminOnly")] : []),
        ...s.stepKeys.map((k) => t(k)),
        ...(s.tipKeys ?? []).map((k) => t(k)),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar role={role} />

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            {t("manual.title")}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin ? t("manual.subtitleAdmin") : t("manual.subtitleCashier")}
          </p>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("manual.searchPlaceholder")}
          className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        />

        {visible.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visible.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition"
              >
                {s.icon} {t(s.titleKey)}
              </a>
            ))}
          </div>
        )}

        {visible.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">
            {t("manual.noResults")}
          </p>
        )}

        {visible.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-20 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-xl">
                {s.icon}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-gray-800">{t(s.titleKey)}</h2>
                {s.admin && (
                  <p className="text-xs text-gray-400">
                    {t("manual.adminOnly")}
                  </p>
                )}
              </div>
            </div>

            <ol className="space-y-2">
              {s.stepKeys.map((stepKey, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                      s.numbered === false
                        ? "bg-gray-100 text-gray-500"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {s.numbered === false ? "•" : i + 1}
                  </span>
                  <span className="min-w-0 break-words">{t(stepKey)}</span>
                </li>
              ))}
            </ol>

            {s.tipKeys && (
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-amber-700">
                  {t("manual.tipsHeader")}
                </p>
                {s.tipKeys.map((tipKey, i) => (
                  <p key={i} className="text-xs text-amber-800 leading-relaxed">
                    • {t(tipKey)}
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}