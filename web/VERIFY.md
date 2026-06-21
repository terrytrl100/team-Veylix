# Verifying a Veylix risk report

Every Veylix risk report can be **independently verified**. You do not have to trust
Veylix's numbers — you can re-compute them yourself and confirm they match a fingerprint
that was committed to the Arbitrum One blockchain, with a timestamp that cannot be altered
or backdated.

This works because the Veylix engine is **deterministic**: the same inputs and the same
fixed random seed always produce exactly the same outputs, on any machine.

## What you need

1. A report's **verification kit** — the JSON file you get from the "Download report" button
   in the app. It contains `canonical_report` (all inputs + outputs) and `report_hash`.
2. The **VeylixAnchor** contract on Arbitrum One:
   `0x5798871aA78054b1283aB87C8eD9987D2b402eFB`

## The fingerprint (hash) algorithm

The `report_hash` is computed as:

```
keccak256( JSON.stringify( canonical_report ) )
```

where `canonical_report` is built with strict canonicalisation so the result is identical
on every machine:

- All object keys are sorted alphabetically, recursively.
- Every number is rounded to a fixed precision (8 decimal places).
- USD values are formatted to 2 decimal places; wallet balances to 6.
- The fixed engine seed (`388821`) is included in `params.seed`.

The exact implementation is open source in `src/lib/report-hash.ts`
(`canonicalReport` → `canonicalJSON` → `hashReport`).

## How to verify (three independent checks)

### 1. The hash matches the data you hold
Re-hash the `canonical_report` in the kit using the algorithm above and confirm it equals
`report_hash`. This proves the file has not been edited.

```js
import { keccak256, toBytes } from "viem";
// canonical = the canonical_report object from the kit
const recomputed = keccak256(toBytes(JSON.stringify(canonical)));
console.log(recomputed === kit.report_hash ? "✅ data intact" : "❌ altered");
```

### 2. The outputs are real (not fabricated)
Re-run the open-source Veylix engine (`src/lib/veylix-sim.ts` → `simulate`) with the inputs
from `canonical_report` (portfolio, calibration, params, seed). Because the engine is
deterministic, you will get the **same outputs** — the same VaR, median, cone, etc. If the
recomputed outputs match those in `canonical_report`, the numbers were genuinely produced by
the engine and not made up.

### 3. The report existed, unaltered, at a specific time
Read the contract on Arbitrum One and confirm the hash was anchored:

```
anchoredAt(report_hash)  ->  a non-zero Unix timestamp
verify(report_hash)      ->  (timestamp, anchoredBy address)
```

You can do this with no wallet and no gas — via Arbiscan's "Read Contract" tab at
`https://arbiscan.io/address/0x5798871aA78054b1283aB87C8eD9987D2b402eFB#readContract`,
or any RPC client. A non-zero timestamp proves the fingerprint was committed at that moment
and has been immutable ever since.

## What this proves

Passing all three checks proves, without trusting Veylix:

- the report data you hold is exactly what was fingerprinted (check 1),
- the risk outputs are reproducible from the inputs by the open engine (check 2), and
- that exact report existed at the on-chain timestamp and has never been altered (check 3).

The blockchain stores only the 32-byte fingerprint — never your holdings or any funds. The
contract is a notary, not a wallet.
