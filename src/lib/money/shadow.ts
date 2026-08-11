import "server-only";
import {
  computeDocumentTotalsLegacy,
  STAMP_DT,
  type CalcLine,
  type CalcOptions,
} from "./document-calc";
import { computeDocumentTotals } from "./totals";
import { toDt } from "./millimes";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The shadow comparison: both engines, one persisted.
 *
 * The legacy float arithmetic is what the application stores — not negotiable
 * until the documented one-centime divergence is approved. But "the new engine
 * disagrees on 0.9% of historical documents" was a study, done once; this
 * makes it a measurement that keeps itself current. Every draft calculation
 * runs through both engines, and a disagreement is recorded in
 * `money_shadow_log` as structure — kind, line count, rate, divergence in
 * millimes — never as amounts, clients or document references.
 *
 * The gate, stated precisely: the millimes engine's output is compared and
 * then DISCARDED. Nothing it computes reaches a stored column, a response, or
 * a rendered page. If this module threw on every call, documents would still
 * be created correctly — which is why callers fire and forget it.
 */

export type ShadowResult = {
  divergenceMillimes: number;
  legacyTotalDt: number;
  engineTotalDt: number;
};

export function compareEngines(lines: CalcLine[], options: CalcOptions): ShadowResult {
  const legacy = computeDocumentTotalsLegacy(lines, options);

  const engine = computeDocumentTotals({
    items: lines.map((l) => ({
      quantity: l.quantity,
      unitPriceDt: l.unit_price_dt,
      isBonus: l.is_bonus ?? false,
    })),
    discount: { type: "amount", valueDt: options.discountDt ?? 0 },
    vat: { enabled: options.tvaEnabled, ratePercent: options.tvaRate },
    fiscalStamp: { enabled: options.applyStamp, amountDt: STAMP_DT },
  });

  const engineTotalDt = toDt(engine.total);
  return {
    divergenceMillimes: Math.round(engineTotalDt * 1000) - Math.round(legacy.total * 1000),
    legacyTotalDt: legacy.total,
    engineTotalDt,
  };
}

/**
 * Records a divergence, if there is one. Fire and forget: a failure here is
 * logged and swallowed, because a measurement must never be able to block the
 * business action it is measuring.
 */
export async function recordShadowDivergence(
  supabase: SupabaseClient,
  kind: string,
  lines: CalcLine[],
  options: CalcOptions,
): Promise<void> {
  try {
    const result = compareEngines(lines, options);
    if (result.divergenceMillimes === 0) return;

    await supabase.from("money_shadow_log").insert({
      kind,
      item_count: lines.length,
      tva_enabled: options.tvaEnabled,
      tva_rate: options.tvaRate,
      stamp_applied: options.applyStamp,
      divergence_millimes: result.divergenceMillimes,
    });
  } catch (err) {
    console.error("[money-shadow]", err);
  }
}
