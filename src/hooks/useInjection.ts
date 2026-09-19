import { useEffect, useMemo, useState } from "react";
import type { Asset, TargetAllocation, CurrencyCode } from "../types";
import { calculateInjection } from "../services/api";
import type { BackendAsset } from "../services/api";
import type { InjectionResultResponse } from "../services/api";
import {
  CURRENCIES,
  FALLBACK_RATES,
  convertCurrencyToUSD,
  convertUSDToCurrency,
} from "../utils/currency";

function buildInjectionAssets(
  assets: Asset[],
  targets: TargetAllocation,
  totalPortfolio: number,
): BackendAsset[] {
  const payload: BackendAsset[] = [];
  const otherAssets = assets.filter(
    (asset) => targets[asset.symbol] === undefined,
  );

  for (const asset of assets) {
    if (targets[asset.symbol] === undefined && targets.OTHER > 0) continue;
    const targetPct = targets[asset.symbol] ?? 0;
    payload.push({
      symbol: asset.symbol,
      name: asset.symbol,
      amount: asset.amount,
      price: asset.price,
      value: asset.usdtValue,
      currentPct:
        totalPortfolio > 0 ? (asset.usdtValue / totalPortfolio) * 100 : 0,
      targetPct,
      targetValue: (targetPct / 100) * totalPortfolio,
      diff: (targetPct / 100) * totalPortfolio - asset.usdtValue,
      diffPct: targetPct - asset.currentPct,
      action:
        targetPct > asset.currentPct
          ? "BUY"
          : targetPct < asset.currentPct
            ? "SELL"
            : "HOLD",
      drift: asset.currentPct - targetPct,
    });
  }

  if (targets.OTHER > 0 && otherAssets.length > 0) {
    const value = otherAssets.reduce((sum, asset) => sum + asset.usdtValue, 0);
    const currentPct = totalPortfolio > 0 ? (value / totalPortfolio) * 100 : 0;
    payload.push({
      symbol: "OTHER",
      name: "OTHER",
      amount: value,
      price: 1,
      value,
      currentPct,
      targetPct: targets.OTHER,
      targetValue: (targets.OTHER / 100) * totalPortfolio,
      diff: (targets.OTHER / 100) * totalPortfolio - value,
      diffPct: targets.OTHER - currentPct,
      action: targets.OTHER > currentPct ? "BUY" : "SELL",
      drift: currentPct - targets.OTHER,
    });
  }

  for (const [symbol, targetPct] of Object.entries(targets)) {
    if (
      symbol === "OTHER" ||
      targetPct <= 0 ||
      payload.some((asset) => asset.symbol === symbol)
    )
      continue;
    payload.push({
      symbol,
      name: symbol,
      amount: 0,
      price: 0,
      value: 0,
      currentPct: 0,
      targetPct,
      targetValue: (targetPct / 100) * totalPortfolio,
      diff: (targetPct / 100) * totalPortfolio,
      diffPct: targetPct,
      action: "BUY",
      drift: -targetPct,
    });
  }
  return payload;
}

export function useInjection(
  assets: Asset[],
  targets: TargetAllocation,
  currency: CurrencyCode,
  rates: Record<string, number>,
) {
  const [inputCurrency, setInputCurrency] = useState<CurrencyCode>(currency);
  const [inputVal, setInputVal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<InjectionResultResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setInputCurrency(currency), [currency]);
  const parsedNum = useMemo(() => {
    const normalized = inputVal.replace(/,/g, "").trim();
    if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return 0;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }, [inputVal]);
  const injectionUSDT = useMemo(
    () =>
      inputCurrency === "USD"
        ? parsedNum
        : convertCurrencyToUSD(parsedNum, inputCurrency, rates),
    [parsedNum, inputCurrency, rates],
  );
  const totalPortfolio = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.usdtValue, 0),
    [assets],
  );
  const targetSum = Object.values(targets).reduce((sum, value) => sum + value, 0);
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [injectionUSDT]);
  const handleCalculate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      injectionUSDT <= 0 ||
      !Number.isFinite(injectionUSDT) ||
      assets.length === 0
    ) {
      setError(
        "Enter a valid positive amount and connect a portfolio before calculating.",
      );
      return;
    }
    if (Math.abs(targetSum - 100) > 0.5) {
      setError("Target allocations must total 100% before calculating.");
      return;
    }
    setCalculating(true);
    setSubmitted(true);
    setError(null);
    try {
      const response = await calculateInjection(
        buildInjectionAssets(assets, targets, totalPortfolio),
        targets,
        injectionUSDT,
      );
      if (!response) {
        setResult(null);
        setError("Unable to calculate the buy plan. Please try again.");
        return;
      }
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to calculate the buy plan.",
      );
    } finally {
      setCalculating(false);
    }
  };
  const toggleConvert = () => {
    if (inputCurrency === "USD") {
      const converted = convertUSDToCurrency(parsedNum, currency, rates);
      setInputCurrency(currency);
      setInputVal(
        currency === "IDR" || currency === "JPY"
          ? String(Math.round(converted))
          : converted.toFixed(2),
      );
    } else {
      setInputCurrency("USD");
      setInputVal(
        convertCurrencyToUSD(parsedNum, inputCurrency, rates).toFixed(2),
      );
    }
    setSubmitted(false);
    setError(null);
  };
  return {
    inputCurrency,
    setInputVal,
    inputVal,
    submitted,
    setSubmitted,
    result,
    calculating,
    error,
    parsedNum,
    injectionUSDT,
    totalPortfolio,
    injectionPct:
      totalPortfolio > 0 && injectionUSDT > 0
        ? (injectionUSDT / totalPortfolio) * 100
        : 0,
    isNonUSD: currency !== "USD",
    activeRate: rates[currency] ?? FALLBACK_RATES[currency] ?? 1,
    currencyMeta: CURRENCIES[inputCurrency] || CURRENCIES.USD,
    hasTargets: Object.values(targets).some((v) => v > 0),
    targetSum,
    handleCalculate,
    toggleConvert,
  };
}
