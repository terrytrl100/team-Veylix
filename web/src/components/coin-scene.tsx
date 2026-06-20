"use client";

import dynamic from "next/dynamic";

const VeylixCoin = dynamic(
  () => import("./veylix-coin").then((m) => m.VeylixCoin),
  { ssr: false, loading: () => <div className="h-full w-full" /> }
);

export function CoinScene() {
  return (
    <div className="h-full w-full">
      <VeylixCoin />
    </div>
  );
}
