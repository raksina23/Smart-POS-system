"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";

type Section = {
  id: string;
  titleKey: TKey;
  admin?: boolean;
  numbered?: boolean;
  stepKeys: TKey[];
  tipKeys?: TKey[];
};

const SECTIONS: Section[] = [
  {
    id: "start",
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
    titleKey: "manual.history.title",
    admin: true,
    stepKeys: [
      "manual.history.step1",
      "manual.history.step2",
    ],
  },
  {
    id: "users",
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

function SectionIcon({ id }: { id: string }) {
  const cls = "w-5 h-5 text-blue-600";
  switch (id) {
    case "start":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
        </svg>
      );
    case "pos":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 6h15l-1.5 9h-12z" strokeLinejoin="round" />
          <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
        </svg>
      );
    case "inventory":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
          <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
        </svg>
      );
    case "categories":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
      );
    case "dashboard":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" strokeLinecap="round" />
        </svg>
      );
    case "ai":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" strokeLinejoin="round" />
          <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z" strokeLinejoin="round" />
        </svg>
      );
    case "history":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" />
          <path d="M16 11a3 3 0 100-6M21 19c0-2.2-1.6-4-4-4.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" strokeLinejoin="round" />
        </svg>
      );
  }
}

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
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
        />

        {visible.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visible.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
              >
                {t(s.titleKey)}
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center">
                <SectionIcon id={s.id} />
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

            <ol className="space-y-2.5">
              {s.stepKeys.map((stepKey, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full text-xs font-bold tabular-nums flex items-center justify-center mt-0.5 ${
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
              <div className="mt-4 bg-amber-50/80 border border-amber-200/60 rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-bold text-amber-800">
                  {t("manual.tipsHeader")}
                </p>
                {s.tipKeys.map((tipKey, i) => (
                  <p key={i} className="text-xs text-amber-900/80 leading-relaxed">
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