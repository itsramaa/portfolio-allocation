import { useMemo } from "react";
import type { Asset } from "../types";
import { calcTotalUSDT, evaluateRebalanceGates } from "../lib/portfolio";

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
  const triggeredAssets = useMemo(
    () =>
      activeAssets.filter((a) => {
        if (a.rebalanceBand <= 0 || a.usdtValue <= 0) return false;
        const driftValue = Math.abs(
          a.usdtValue - (a.targetPct / 100) * totalUSDT,
        );
        return evaluateRebalanceGates(
          Math.abs(a.drift),
          a.rebalanceBand,
          driftValue,
          driftValue,
          totalUSDT,
          "core",
        ).isTriggered;
      }),
    [activeAssets, totalUSDT],
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
