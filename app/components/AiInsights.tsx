"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { TKey } from "../lib/dictionaries";

type Kind = "purchase" | "shelf";

type PurchaseItem = {
  product_id: string;
  name: string;
  units_sold: number;
  current_stock: number;
  suggested_qty: number;
  days_left?: number | null;
};

type ShelfItem = {
  product_a: string;
  product_b: string;
  pair_orders: number;
  total_bills?: number;
  together_pct?: number;
  a_to_b_pct?: number;
  b_to_a_pct?: number;
  strength?: "strong" | "medium";
};

type Rec = {
  content: string;
  source_data: any[];
  created_at: string;
} | null;

function SparklesIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 3l1.3 3.7L14.5 8l-3.7 1.3L9.5 13l-1.3-3.7L4.5 8l3.7-1.3L9.5 3z" strokeLinejoin="round" />
      <path d="M18 13l.8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13z" strokeLinejoin="round" />
      <path d="M6 16l.6 1.4L8 18l-1.4.6L6 20l-.6-1.4L4 18l1.4-.6L6 16z" strokeLinejoin="round" />
    </svg>
  );
}

function CartIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6h15l-1.5 9h-12z" strokeLinejoin="round" />
      <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

function BoxIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <path d="M3 8l9 5 9-5M12 13v8" strokeLinejoin="round" />
    </svg>
  );
}

function PctBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm text-gray-600">
        <span className="min-w-0 break-words leading-snug">{label}</span>
        <span className="shrink-0 font-bold text-gray-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function AiInsights() {
  const { t, locale } = useI18n();

  const [recs, setRecs] = useState<{
    purchase: Rec;
    shelf: Rec;
  }>({
    purchase: null,
    shelf: null,
  });

  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<{
    key: TKey;
    vars?: Record<string, string | number>;
  } | null>(null);

  const call = async (method: "GET" | "POST", kind?: Kind) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/ai/recommendations", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: kind ? JSON.stringify({ kind, locale }) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "");
    }

    return json;
  };

  useEffect(() => {
    call("GET")
      .then(setRecs)
      .catch(() => {});
  }, []);

  const generate = async (kind: Kind) => {
    setBusy(kind);
    setError(null);

    try {
      await call("POST", kind);
      setRecs(await call("GET"));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "NO_FREQUENT_PAIRS") {
        setError({ key: "aiInsights.errorNoFrequentPairs" });
      } else if (msg) {
        setError({ key: "aiInsights.errorMessage", vars: { message: msg } });
      } else {
        setError({ key: "aiInsights.errorGeneric" });
      }
    } finally {
      setBusy(null);
    }
  };

  const renderCard = ({
    kind,
    title,
    subtitle,
    icon,
    emptyIcon,
    rec,
  }: {
    kind: Kind;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    emptyIcon: React.ReactNode;
    rec: Rec;
  }) => {
    const isBusy = busy === kind;

    return (
      <section className="w-full min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                {icon}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 leading-snug">
                  {title}
                </h3>

                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => generate(kind)}
              disabled={busy !== null}
              className="w-full sm:w-auto sm:self-end bg-purple-600 text-white text-sm font-bold px-5 py-3 rounded-xl hover:bg-purple-700 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {t("aiInsights.analyzing")}
                </span>
              ) : (
                t("aiInsights.analyze")
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 min-w-0 space-y-5">
          {rec ? (
            <>
              {/* AI Summary */}
              <div className="bg-purple-50/70 rounded-xl p-4 border border-purple-100">
                <p className="text-sm font-bold text-purple-700 mb-2">
                  {t("aiInsights.aiRecommendation")}
                </p>

                <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line break-words">
                  {rec.content}
                </p>
              </div>

              {/* Purchase Plan */}
              {kind === "purchase" && (
                <div className="space-y-3 min-w-0">
                  <div>
                    <h4 className="text-base font-bold text-gray-800">
                      {t("aiInsights.recommendedProducts")}
                    </h4>

                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                      {t("aiInsights.recommendedProductsSubtitle")}
                    </p>
                  </div>

                  {(() => {
                    const items = (rec.source_data as PurchaseItem[])
                      .filter((r) => r.suggested_qty > 0)
                      .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))
                      .slice(0, 5);

                    return items.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm text-left min-w-[440px]">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3.5 py-3 font-bold">
                                {t("aiInsights.colProduct")}
                              </th>
                              <th className="px-3.5 py-3 font-bold text-center">
                                {t("aiInsights.colDaysLeft")}
                              </th>
                              <th className="px-3.5 py-3 font-bold text-center">
                                {t("aiInsights.colStock")}
                              </th>
                              <th className="px-3.5 py-3 font-bold text-center">
                                {t("aiInsights.colSuggest")}
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {items.map((r) => (
                              <tr
                                key={r.product_id}
                                className="border-t border-gray-100 hover:bg-purple-50/40 transition"
                              >
                                <td className="px-3.5 py-3.5 font-semibold text-gray-800">
                                  {r.name}
                                </td>

                                <td className="px-3.5 py-3.5 text-center text-gray-600 tabular-nums">
                                  {r.days_left != null
                                    ? t("aiInsights.daysLeft", { n: r.days_left })
                                    : "-"}
                                </td>

                                <td className="px-3.5 py-3.5 text-center text-gray-600 tabular-nums">
                                  {r.current_stock}
                                </td>

                                <td className="px-3.5 py-3.5 text-center font-bold text-purple-600 tabular-nums">
                                  +{r.suggested_qty}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-5 bg-gray-50 rounded-xl">
                        {t("aiInsights.noPurchaseItems")}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Shelf Arrangement */}
              {kind === "shelf" && (
                <div className="space-y-3 min-w-0">
                  <div>
                    <h4 className="text-base font-bold text-gray-800">
                      {t("aiInsights.recommendedPairs")}
                    </h4>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                      {t("aiInsights.recommendedPairsSubtitle")}
                    </p>
                  </div>

                  {(() => {
                    const pairs = rec.source_data as ShelfItem[];

                    if (pairs.length === 0 || pairs[0].total_bills === undefined) {
                      return (
                        <p className="text-sm text-gray-400 text-center py-5 bg-gray-50 rounded-xl">
                          {t("aiInsights.reanalyzePrompt")}
                        </p>
                      );
                    }

                    return (
                      <>
                        <p className="text-sm text-gray-500 tabular-nums">
                          {t("aiInsights.analyzedSummary", {
                            bills: pairs[0].total_bills,
                            pairs: pairs.length,
                          })}
                        </p>

                        <div className="space-y-2.5">
                          {pairs.map((r, i) => (
                            <div
                              key={i}
                              className="p-3.5 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span className="shrink-0 w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold tabular-nums">
                                    {i + 1}
                                  </span>
                                  <p className="text-base font-bold text-gray-800 leading-snug break-words min-w-0">
                                    {r.product_a}
                                    <span className="text-purple-500 mx-1.5">+</span>
                                    {r.product_b}
                                  </p>
                                </div>

                                <span
                                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-bold ${
                                    r.strength === "strong"
                                      ? "bg-purple-600 text-white"
                                      : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {r.strength === "strong"
                                    ? t("aiInsights.strengthStrong")
                                    : t("aiInsights.strengthMedium")}
                                </span>
                              </div>

                              <div className="space-y-2.5 pt-1 border-t border-gray-200/60">
                                <p className="text-sm text-gray-600 tabular-nums">
                                  {t("aiInsights.boughtTogetherPrefix")}{" "}
                                  <b className="text-gray-800">{r.pair_orders}</b>{" "}
                                  {t("aiInsights.boughtTogetherSuffix", {
                                    pct: r.together_pct ?? 0,
                                  })}
                                </p>

                                <PctBar
                                  label={t("aiInsights.crossBuyLabel", {
                                    productA: r.product_a,
                                    productB: r.product_b,
                                  })}
                                  pct={r.a_to_b_pct ?? 0}
                                />
                                <PctBar
                                  label={t("aiInsights.crossBuyLabel", {
                                    productA: r.product_b,
                                    productB: r.product_a,
                                  })}
                                  pct={r.b_to_a_pct ?? 0}
                                />

                                <p className="text-sm font-semibold text-purple-700 pt-0.5">
                                  {t("aiInsights.shelfTip")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Updated Time */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs sm:text-sm text-gray-400 tabular-nums">
                  {t("aiInsights.lastAnalyzed", {
                    date: new Date(rec.created_at).toLocaleString(locale),
                  })}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-10 sm:py-12">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3.5">
                {emptyIcon}
              </div>

              <p className="text-base font-bold text-gray-700">
                {t("aiInsights.noAnalysis")}
              </p>

              <p className="text-sm text-gray-400 mt-1.5 max-w-xs leading-relaxed">
                {t("aiInsights.noAnalysisHint")}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-4 md:space-y-6">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 shrink-0" />

          <h2 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">
            {t("aiInsights.title")}
          </h2>
        </div>

        <p className="text-sm text-gray-500 mt-1">
          {t("aiInsights.subtitle")}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600 font-medium break-words">
            {t(error.key, error.vars)}
          </p>
        </div>
      )}

      {/* Responsive Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full items-stretch">
        {renderCard({
          kind: "purchase",
          title: t("aiInsights.purchaseTitle"),
          subtitle: t("aiInsights.purchaseSubtitle"),
          icon: <CartIcon className="w-6 h-6" />,
          emptyIcon: <CartIcon className="w-7 h-7" />,
          rec: recs.purchase,
        })}

        {renderCard({
          kind: "shelf",
          title: t("aiInsights.shelfTitle"),
          subtitle: t("aiInsights.shelfSubtitle"),
          icon: <BoxIcon className="w-6 h-6" />,
          emptyIcon: <BoxIcon className="w-7 h-7" />,
          rec: recs.shelf,
        })}
      </div>
    </div>
  );
}