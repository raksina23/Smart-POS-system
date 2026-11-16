"use client";
import React from "react";
import { useI18n } from "../lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="inline-flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden text-sm font-bold"
      role="group"
      aria-label="Language"
    >
      {(["th", "en"] as const).map((l) => {
        const isActive = lang === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLang(l)}
            className={`min-w-[44px] px-3 py-2 transition active:scale-95 ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {l === "th" ? "ไทย" : "EN"}
          </button>
        );
      })}
    </div>
  );
}