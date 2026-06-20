import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, base, arbitrum, optimism, polygon, sepolia } from "wagmi/chains";

/**
 * WalletConnect Cloud project id.
 *
 * Get a free id at https://cloud.reown.com and set it in `.env.local`:
 *   NEXT_PUBLIC_WC_PROJECT_ID=your_id_here
 *
 * Without a real id, injected/browser wallets (e.g. MetaMask) still connect;
 * only the WalletConnect QR / mobile flow requires it. We fall back to a
 * placeholder so the app builds and runs out of the box.
 */
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "veylix_dev_placeholder";

const enableTestnets = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true";

export const wagmiConfig = getDefaultConfig({
  appName: "Veylix",
  appDescription: "Pre-trade risk visibility for retail crypto.",
  projectId,
  chains: [
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
    ...(enableTestnets ? [sepolia] : []),
  ],
  // Veylix uses Next.js App Router with server rendering.
  ssr: true,
});
