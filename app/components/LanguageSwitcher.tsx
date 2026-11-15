"use client";
import { useI18n } from "../lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold" role="group" aria-label="Language">
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1.5 transition ${
            lang === l ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}