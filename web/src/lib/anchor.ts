// VeylixAnchor contract config for Arbitrum One (mainnet).
//
// >>> AFTER DEPLOYING via Remix, paste the deployed address below. <<<
// Until then anchoring will fail fast with a clear message.

export const ANCHOR_ADDRESS = "0x5798871aA78054b1283aB87C8eD9987D2b402eFB" as `0x${string}`;

export const ANCHOR_CHAIN_ID = 42161; // Arbitrum One

export const ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [{ name: "reportHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [{ name: "reportHash", type: "bytes32" }],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
  },
  {
    type: "function",
    name: "anchoredAt",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Anchored",
    inputs: [
      { name: "reportHash", type: "bytes32", indexed: true },
      { name: "by", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const isAnchorDeployed = () =>
  ANCHOR_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const arbiscanTx = (hash: string) => `https://arbiscan.io/tx/${hash}`;
