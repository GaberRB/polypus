/** Token + cost readout for the active run. Pure presentational component. */
import type { ModelPrice } from "../transport.js";

function fmtTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function UsageBar({
  promptTokens,
  completionTokens,
  price,
}: {
  promptTokens: number;
  completionTokens: number;
  price: ModelPrice | null;
}): JSX.Element | null {
  const total = promptTokens + completionTokens;
  if (total === 0) return null;

  const costUsd = price
    ? (promptTokens * price.promptPrice + completionTokens * price.completionPrice) / 1_000_000
    : null;

  return (
    <div className="usage-bar">
      <span>↑ {fmtTokens(promptTokens)}</span>
      <span className="usage-sep">·</span>
      <span>↓ {fmtTokens(completionTokens)}</span>
      <span className="usage-sep">·</span>
      <span>{fmtTokens(total)} tokens</span>
      {costUsd !== null && (
        <>
          <span className="usage-sep">·</span>
          <span className="usage-cost">{fmtCost(costUsd)}</span>
        </>
      )}
    </div>
  );
}
