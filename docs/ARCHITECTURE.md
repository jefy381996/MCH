# Architecture

## Components

```
                 ┌────────────────────────────── price engine (packages/price-engine) ─┐
 PriceSource ──> │ QuoteGuard ──> PriceStore (Postgres) ──> PriceEngine ──> Fastify API  │──> website
 (demo today)    │  bad-tick       quotes + snapshots      computes index   REST + WS    │   (packages/web)
                 └──────────────────────────────────────────────────────────────────────┘
                                                            │ GET /api/index
                                                            v
                                    oracle submitter (packages/chain, separate process,
                                    holds the operator key) ── signed tx ──> Cardano
                                                                              oracle validator
 website <── GET /api/oracle <── keyless reader (packages/chain) <───────── (reads the feed UTxO)
```

| Piece                  | Holds keys?        | Talks to                                      |
| ---------------------- | ------------------ | --------------------------------------------- |
| Price engine + website | No                 | Price provider, Postgres, Cardano (read-only) |
| Oracle submitter       | Operator key (hot) | Price engine API, Cardano                     |
| Admin wallet           | Admin key (cold)   | Used by hand: deploy, rotate operator, close  |

## The index

`packages/index-core/src/index-math.ts` is the specification:

```
index_micro = round_half_up( SUM_i floor(100 × w_i × p_i × 10^12 / b_i) / 10^12 )
```

- `w_i`: weight in parts per million (weights sum to exactly 1,000,000)
- `p_i`, `b_i`: current and base-date price in micro-USD (integers)
- result: index × 10^6, e.g. `101750000` = 101.75

The same function is implemented in Aiken (`contracts/lib/mch/index_math.ak`).
`contracts/lib/mch/index_vectors.test.ak` is generated from the TypeScript
implementation (162 cases, hand-written plus seeded random), so `aiken check`
fails if the two ever disagree. The hand-written expected values come from an
independent exact-fraction reference (`packages/index-core/test/gen-vectors.py`).

## Guarding against bad prices

`QuoteGuard` (packages/price-engine/src/guard.ts) checks every quote:

- non-positive prices and future timestamps are rejected;
- a quote no newer than the last accepted one is ignored;
- a jump beyond the metal's limit (gold 5%, silver and platinum 8%, nickel 10%)
  is **quarantined**. It is accepted only when three distinct, newer quotes
  agree with each other within 1%. A single bad print never reaches the index;
  a real move gets through after a short delay, with an alert.

## On-chain design

### Oracle validator (`contracts/validators/oracle.ak`)

One UTxO at the script holds the auth NFT (`MCH-ORACLE`) and an inline datum:
index, prices (basket order), `published_at`, `sequence`, basket version and
the operator key hash.

| Action         | Signed by | Rules                                                                                                                                                                                                                                            |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create (mint)  | admin     | Consumes the seed UTxO, so it can only ever happen once; valid basket; NFT sent to the script with sequence 0 and a correct index                                                                                                                |
| Update         | operator  | Sequence +1; `published_at` strictly later and inside the transaction's validity range; range at most 10 minutes wide; index equals the index recomputed from the posted prices; NFT stays at the script with only ADA beside it; nothing minted |
| RotateOperator | admin     | Only the operator field changes                                                                                                                                                                                                                  |
| Close          | admin     | Burns the auth NFT                                                                                                                                                                                                                               |

The basket (weights and base prices) is a validator **parameter**: changing it
produces a new script and a new feed. Nobody can quietly re-weight the index.

Other contracts read the feed with `mch/feed.{find_feed, is_fresh}`.

### MCH token (`contracts/validators/mch_token.ak`)

CIP-68 fungible token. One transaction, which must consume a seed UTxO, mints
the entire supply plus a reference NFT that carries the name, ticker,
decimals and logo. No further minting is possible by anyone. Holders may
burn their own tokens. The admin may update the metadata.

### Reference scripts (`contracts/validators/script_store.ak`)

An always-fail address. Scripts published there can never be removed, and
updates reference them instead of carrying 3 KB of script each time:
about 0.26 ADA per update instead of 0.34.

## Keys and failure modes

| If this happens                   | Effect                                                            | Response                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Operator key leaks                | Attacker can publish _self-consistent_ but false prices           | Admin runs `rotateOperator`; investigate; consider a multi-signer oracle                                        |
| Admin key leaks                   | Attacker can rotate the operator or close the feed                | Keep the admin key on a hardware wallet; it is used rarely                                                      |
| Price provider down               | No new snapshots; on-chain value ages                             | Engine alerts after 5 failures; submitter alerts when the feed is stale                                         |
| Price engine wrong or compromised | Submitter re-verifies every snapshot; contract rechecks the index | Inconsistent data cannot be signed or accepted. Consistent but wrong prices can: hence the guard and the alerts |

## Tests

| Layer           | What is tested                                                                   | Where                                  |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| Index maths     | Hand vectors, 20,000 random cases vs exact fractions                             | `packages/index-core/test`             |
| Contracts       | 221 Aiken tests: each rule broken one at a time, with controls                   | `contracts/`                           |
| Transactions    | Real compiled scripts on an emulated ledger; rejections must be script failures  | `packages/chain/test/emulator.test.ts` |
| Backend         | Guard, engine, both stores (one shared contract), API, WebSocket, static serving | `packages/price-engine/test`           |
| Website helpers | Formatting, chart scales, wallet balance decoding                                | `packages/web/test`                    |
