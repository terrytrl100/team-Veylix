"use client";

import { useCallback, useMemo } from "react";
import { Loader2, ShieldCheck, ExternalLink, Download } from "lucide-react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import type { SimResult, Instrument } from "@/lib/veylix-sim";
import type { Portfolio, Calibration } from "@/lib/types";
import type { ScenarioOverrides } from "@/lib/scenario";
import { hashReport, buildVerificationKit } from "@/lib/report-hash";
import {
  ANCHOR_ADDRESS, ANCHOR_ABI, ANCHOR_CHAIN_ID, isAnchorDeployed, arbiscanTx,
} from "@/lib/anchor";

interface AnchorReportProps {
  portfolio: Portfolio;
  calibration: Calibration;
  scenarioOverrides: ScenarioOverrides | null;
  params: { h: number; instrument: Instrument; horizonDays: number };
  sim: SimResult;
  /** Optional one-line context shown under the heading. */
  note?: string;
}

// Hash the report, write the hash to Arbitrum One, and let the user download
// the verification kit. Self-heals: after submitting, it polls the contract so
// a dropped WalletConnect confirmation still resolves to "anchored".
export default function AnchorReport({
  portfolio, calibration, scenarioOverrides, params, sim, note,
}: AnchorReportProps) {
  const { isConnected, chainId } = useAccount();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const input = useMemo(
    () => ({ portfolio, calibration, scenarioOverrides, params, sim }),
    [portfolio, calibration, scenarioOverrides, params, sim],
  );
  const reportHash = useMemo(() => hashReport(input), [input]);

  // While a tx is in-flight, poll the contract so a dropped WalletConnect
  // confirmation still resolves to "anchored". We derive whether to poll from
  // render state (tx submitted but not yet seen on-chain) rather than storing
  // a separate flag, so there's no setState-in-effect.
  const { data: existing } = useReadContract({
    address: ANCHOR_ADDRESS,
    abi: ANCHOR_ABI,
    functionName: "anchoredAt",
    args: [reportHash],
    chainId: ANCHOR_CHAIN_ID,
    query: {
      enabled: isAnchorDeployed(),
      refetchInterval: (isPending || !!txHash) ? 4000 : false,
    },
  });
  const anchoredTs = typeof existing === "bigint" && existing > BigInt(0) ? Number(existing) : 0;
  const anchored = anchoredTs > 0;

  const wrongNetwork = isConnected && chainId !== ANCHOR_CHAIN_ID;

  const onAnchor = useCallback(() => {
    reset();
    writeContract({
      address: ANCHOR_ADDRESS,
      abi: ANCHOR_ABI,
      functionName: "anchor",
      args: [reportHash],
      chainId: ANCHOR_CHAIN_ID,
    });
  }, [writeContract, reportHash, reset]);

  const onDownload = useCallback(() => {
    const kit = buildVerificationKit(input);
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veylix-report-${reportHash.slice(2, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [input, reportHash]);

  const short = `${reportHash.slice(0, 10)}…${reportHash.slice(-8)}`;
  // "anchoring" = submitted and waiting for either the WC confirmation or the
  // chain poll to report success.
  const anchoring = (isPending || !!txHash) && !anchored;

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-upside" />
        <p className="text-[10px] uppercase tracking-widest text-muted">Verifiable on-chain</p>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        {note ??
          "Anchor this report's fingerprint to Arbitrum, then download the data. Anyone can re-run the engine with these inputs, re-hash, and confirm it matches the chain."}
      </p>
      <p className="font-mono text-[10px] text-muted/70 tabular break-all">hash: {short}</p>

      <div className="flex flex-wrap items-center gap-2">
        {/* Download is always available — it's the verification kit. */}
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground hover:border-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download report
        </button>

        {!isAnchorDeployed() ? (
          <span className="text-[11px] text-downside">Anchor contract not configured.</span>
        ) : anchored ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-upside">
            <ShieldCheck className="h-3.5 w-3.5" />
            {txHash ? (
              <a href={arbiscanTx(txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                Anchored — view on Arbiscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <>Anchored on {new Date(anchoredTs * 1000).toLocaleString()}</>
            )}
          </span>
        ) : anchoring ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Anchoring… confirming on-chain
          </span>
        ) : !isConnected ? (
          <span className="text-[11px] text-muted">Connect a wallet to anchor.</span>
        ) : wrongNetwork ? (
          <span className="text-[11px] text-downside">Switch to Arbitrum One to anchor.</span>
        ) : (
          <button
            onClick={onAnchor}
            className="inline-flex items-center gap-1.5 rounded-lg border border-upside/40 bg-upside/10 px-3 py-1.5 text-[11px] font-medium text-upside hover:bg-upside/20 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Anchor on-chain
          </button>
        )}
      </div>

      {error && !anchored && (
        <p className="text-[11px] text-downside">
          {error.message.includes("already anchored")
            ? "This exact report is already anchored."
            : "Could not anchor — the transaction was rejected or the connection dropped. If you approved it, give it a few seconds to confirm."}
        </p>
      )}
    </div>
  );
}
