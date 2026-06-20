"use client";

import { useMemo } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { TOKEN_REGISTRY } from "@/lib/token-registry";
import type { Portfolio } from "@/lib/types";

export interface WalletPortfolioResult {
  portfolio: Portfolio | null;
  isLoading: boolean;
  hasBalances: boolean;
}

export function useWalletPortfolio(): WalletPortfolioResult {
  const { address, chainId } = useAccount();

  // Native ETH balance
  const { data: ethData, isLoading: ethLoading } = useBalance({ address });

  // ERC-20 tokens available on the current chain
  const tokens = useMemo(
    () => (chainId ? (TOKEN_REGISTRY[chainId] ?? []) : []),
    [chainId]
  );

  const contracts = useMemo(
    () =>
      tokens.map((t) => ({
        address: t.address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [address!] as readonly [`0x${string}`],
      })),
    [tokens, address]
  );

  const { data: erc20Data, isLoading: erc20Loading } = useReadContracts({
    contracts,
    query: { enabled: !!address && tokens.length > 0 },
  });

  const portfolio = useMemo<Portfolio | null>(() => {
    if (!address || !ethData) return null;

    const coins: Array<{
      coin: string;
      usdValue: string;
      walletBalance: string;
    }> = [];

    // Native ETH
    const ethQty = parseFloat(ethData.formatted);
    if (ethQty > 0.0001) {
      coins.push({
        coin: "ETH",
        usdValue: "0",
        walletBalance: ethQty.toFixed(6),
      });
    }

    // ERC-20 balances
    erc20Data?.forEach((result, i) => {
      if (result.status !== "success") return;
      const token = tokens[i];
      const raw = result.result as bigint;
      const qty = Number(raw) / Math.pow(10, token.decimals);
      if (qty <= 0) return;

      const existing = coins.find((c) => c.coin === token.symbol);
      if (existing) {
        existing.walletBalance = (
          parseFloat(existing.walletBalance) + qty
        ).toFixed(6);
      } else {
        coins.push({
          coin: token.symbol,
          usdValue: "0",
          walletBalance: qty.toFixed(6),
        });
      }
    });

    if (coins.length === 0) return null;

    return {
      result: {
        list: [{ accountType: "WALLET", totalEquity: "0", coin: coins }],
      },
    };
  }, [address, ethData, erc20Data, tokens]);

  return {
    portfolio,
    isLoading: ethLoading || erc20Loading,
    hasBalances: (portfolio?.result.list[0].coin.length ?? 0) > 0,
  };
}
