import { useMemo } from "react";
import type { Asset } from "../types";
import { calcTotalUSDT, evaluateRebalanceGates, isFuturesAsset } from "../lib/portfolio";

export function useDashboard(assets: Asset[]) {
  const totalUSDT = useMemo(() => calcTotalUSDT(assets), [assets]);
  const activeAssets = useMemo(
    () => assets.filter((asset) => asset.usdtValue > 0),
    [assets],
  );
  const largestAsset = useMemo(
    () =>
      activeAssets.reduce<Asset | undefined>(
        (largest, asset) =>
          !largest || asset.usdtValue > largest.usdtValue ? asset : largest,
        undefined,
      ),
    [activeAssets],
  );
  const assetsWithTarget = useMemo(
    () => activeAssets.filter((asset) => asset.targetPct > 0),
    [activeAssets],
  );
  const driftData = useMemo(
    () =>
      activeAssets
        .filter((a) => a.targetPct > 0 || a.currentPct > 1)
        .slice(0, 10)
        .map((a) => ({
          asset: a.symbol,
          current: a.currentPct,
          target: a.targetPct,
          band: a.rebalanceBand,
        })),
    [activeAssets],
  );
  const allocationData = useMemo(() => {
    const sorted = [...activeAssets].sort((a, b) => b.usdtValue - a.usdtValue);
    const visible: Array<{
      name: string;
      value: number;
      payload?: Asset;
      color: string;
    }> = sorted.slice(0, 7).map((asset) => ({
      name: asset.symbol,
      value: asset.usdtValue,
      payload: asset,
      color: asset.logoColor,
    }));
    const remainder = sorted
      .slice(7)
      .reduce((sum, asset) => sum + asset.usdtValue, 0);
    if (remainder > 0)
      visible.push({
        name: "Other",
        value: remainder,
        payload: undefined,
        color: "#848E9C",
      });
    return visible;
  }, [activeAssets]);
  const spotTotalUSDT = useMemo(() => activeAssets.filter((asset) => !isFuturesAsset(asset.symbol)).reduce((sum, asset) => sum + asset.usdtValue, 0), [activeAssets]);
  const spotTargetSum = useMemo(() => activeAssets.filter((asset) => !isFuturesAsset(asset.symbol)).reduce((sum, asset) => sum + Math.max(0, asset.targetPct), 0), [activeAssets]);
  const triggeredAssets = useMemo(
    () =>
      activeAssets.filter((a) => {
        if (isFuturesAsset(a.symbol) || a.rebalanceBand <= 0 || a.usdtValue <= 0 || spotTargetSum <= 0) return false;
        const effectiveTargetPct = a.targetPct > 0 ? (a.targetPct / spotTargetSum) * 100 : 0;
        const currentPct = spotTotalUSDT > 0 ? (a.usdtValue / spotTotalUSDT) * 100 : 0;
        const driftValue = Math.abs(
          a.usdtValue - (effectiveTargetPct / 100) * spotTotalUSDT,
        );
        return evaluateRebalanceGates(
          Math.abs(currentPct - effectiveTargetPct),
          a.rebalanceBand,
          driftValue,
          driftValue,
          spotTotalUSDT,
          "core",
        ).isTriggered;
      }),
    [activeAssets, spotTargetSum, spotTotalUSDT],
  );
  return {
    totalUSDT,
    activeAssets,
    largestAsset,
    assetsWithTarget,
    driftData,
    allocationData,
    triggeredAssets,
  };
}
