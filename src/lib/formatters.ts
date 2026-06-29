/**
 * Formata valor em BRL: "R$ 1.234,56".
 * NaN/null/undefined → "R$ 0,00".
 */
export function formatCurrencyBRL(value: number | null | undefined): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/**
 * Formata valor em BRL compacto: "R$ 1,2 mil", "R$ 3,4 mi", "R$ 1,2 bi".
 * Útil pra eixos de gráficos e KPIs com pouco espaço.
 */
export function formatCurrencyBRLCompact(value: number | null | undefined): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(v);
}

/**
 * Formata número PT-BR: "1.234,56".
 */
export function formatNumberBR(
  value: number | null | undefined,
  fractionDigits = 2,
): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(v);
}

/**
 * Formata percentual: 0.1234 → "12,34%".
 * Se `alreadyPercent` for true, assume que o valor já está em escala 0–100.
 */
export function formatPercentBR(
  value: number | null | undefined,
  fractionDigits = 2,
  alreadyPercent = false,
): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const scaled = alreadyPercent ? v / 100 : v;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(scaled);
}
