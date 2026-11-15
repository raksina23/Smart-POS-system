"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dictionaries, Lang, TKey } from "./dictionaries";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  locale: string; // ใช้กับวันที่และตัวเลข
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th"); // ภาษาเริ่มต้น เปลี่ยนเป็น "en" ได้

  // อ่านภาษาที่เคยเลือกไว้หลังหน้าโหลด (ไม่อ่านตอน render แรก เพื่อกัน hydration error)
  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "th" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t: Ctx["t"] = (key, vars) => {
    let text: string = dictionaries[lang][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, locale: lang === "th" ? "th-TH" : "en-GB" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n ต้องใช้ภายใน I18nProvider");
  return ctx;
}