# MCH (Metal Chain) — Project Roadmap

**Status:** planning. Nothing built yet. This document is the shared plan; it gets
updated as decisions are made.

**Last updated:** 2026-10-06

---

## 1. What MCH is, in one paragraph

MCH is a Cardano token whose value is meant to follow a basket of four metals
(gold, copper, nickel, magnesium). A backend service reads metal prices from the
market, blends them into a single number (the "MCH Index"), publishes that number
on the Cardano blockchain, and a website shows it live to visitors.

---

## 2. The four moving parts

Most people describe this project as "website + backend + token". It is actually
**four** parts. The fourth one is the part that is usually underestimated.

| # | Part | Plain description | Tech |
|---|------|-------------------|------|
| 1 | **Price engine** (backend) | Fetches metal prices, cleans them, stores history, computes the MCH Index | TypeScript (Node), PostgreSQL, Redis |
| 2 | **Oracle** | Writes the Index onto the Cardano blockchain so smart contracts can read it | Aiken validator + signing service |
| 3 | **Token + contracts** | The MCH token itself and the rules for creating/destroying it | Aiken (minting policy, vault validator) |
| 4 | **Website** (frontend) | Live price chart, index breakdown, wallet connect, mint/redeem screen | Next.js + React, CIP-30 wallet connect |

A blockchain cannot reach out to the internet by itself. It only knows what
someone writes into it. Part 2 (the oracle) is that someone. Without it, the
token has no idea what gold costs.

---

## 3. The single most important thing to understand

**Code cannot set a token's market price.**

A token's price is whatever people pay for it on an exchange. We can publish
"the MCH Index is $118.40" all day long; that does not force anyone to buy or
sell at $118.40. The link between "metal prices moved" and "token price moved"
has to be built with real economics, not just software.

There are exactly three honest ways to do it. Pick one.

### Model A — "Scoreboard token" (tracker / reference only)

- We publish the Index on-chain and on the website. The token exists and can be
  traded, but nothing guarantees its trading price equals the Index.
- **Analogy:** a thermometer on the wall. It reports the temperature. It does not
  heat the room.
- **Cost:** low. **Time:** weeks. **Capital required:** none.
- **Honesty requirement:** the website must say plainly that the token is *not*
  backed by metal and its market price may differ from the Index. Saying or
  implying otherwise is how projects get sued.

### Model B — "Vault token" (fully backed, redeemable)

- A legal entity holds real reserves — physical metal with a custodian, or cash /
  stablecoins — worth the full value of every token in circulation.
- Anyone can **mint** a token by paying the current Index value, and **redeem** a
  token for the current Index value. That redemption right is what glues the
  market price to the Index: if the token trades below the Index, traders buy it
  cheap and redeem it for full value, which pushes the price back up.
- **Analogy:** a cloakroom ticket. It is worth the coat, because you can always
  swap it back for the coat.
- **Cost:** high. **Capital required:** 100% of token value, plus custodian fees,
  audits, legal setup.
- **Reality check:** this is a regulated financial product nearly everywhere. It
  needs a company, a lawyer, KYC/AML, reserve attestations, and most likely a
  licence. It is not a weekend build.

### Model C — "Collateral vault" (synthetic, over-collateralised)

- No metal is held. Instead, users lock up crypto (ADA or a stablecoin) worth
  150–400% of what they mint, and mint synthetic MCH against it. If the Index
  rises and their collateral no longer covers it, their position is liquidated.
- This is how Cardano projects like Indigo's iAssets and DJED work.
- **Analogy:** a pawn shop with a margin call.
- **Cost:** high engineering cost, medium capital. Needs liquidation bots, deep
  liquidity, and a serious security audit. The most code of the three, and the
  most ways to lose other people's money if it has a bug.

### Recommended path

**Build Model A's infrastructure first, on Cardano's test network.** The reason:
parts 1, 2 and 4 — the price engine, the oracle and the website — are *identical
in all three models*. That is roughly 60% of the total work. Building it first is
not a detour; it is the shared foundation. Once it runs, you will understand the
system well enough to choose B or C with a lawyer, and nothing is wasted.

---

## 4. How the Index is calculated

Different metals are quoted in different units, which makes naive averaging
meaningless:

| Metal | Typical quote unit | On LME? |
|-------|--------------------|---------|
| Gold | USD per troy ounce | Yes (LMEprecious) |
| Copper | USD per tonne | Yes |
| Nickel | USD per tonne | Yes |
| Magnesium | USD per tonne (usually China FOB) | **No** |

You cannot add "$4,000 per ounce" to "$9,500 per tonne" and get anything sensible.
The fix is to measure each metal as a **percentage change from a fixed start date**,
then blend the percentages:

```
Index(today) = 100 x SUM over metals of [ weight_i x (price_i today / price_i on base date) ]
```

Weights add up to 1. The base date is the day we switch on; the Index starts at
exactly 100 so every later number reads as "up or down X% since launch".

**Worked example** — equal weights (25% each). Since the base date gold is up 10%,
copper down 5%, nickel up 2%, magnesium flat:

```
Index = 100 x (0.25x1.10 + 0.25x0.95 + 0.25x1.02 + 0.25x1.00)
      = 100 x (0.2750 + 0.2375 + 0.2550 + 0.2500)
      = 101.75
```

So the Index reads 101.75 — the basket is up 1.75% since launch. Unit mismatches
disappear because every ratio is a plain number.

Decisions still needed here: the weights, the base date, and whether weights ever
get rebalanced (and if so, who is allowed to change them — that is a governance
question, and an attack surface).

---

## 5. Where prices actually come from

### What "real-time" honestly means for metals

Crypto trades 24/7. **Metals do not.** The LME runs on London hours across its
Ring, LMEselect and inter-office markets, and publishes its headline Official
Prices once per business day around midday London time. Overnight, at weekends
and on UK holidays there is no new price.

So the website will show: **live prices during market hours; last known price with
a visible "as of" timestamp when the market is closed.** Any design that promises
a constantly ticking metal price is lying to the user. We will show the timestamp
prominently on every number.

### Data source options

| Option | What you get | Cost | Can you republish it publicly? |
|--------|--------------|------|-------------------------------|
| **Free / delayed public sources** | Scraped or delayed indicative prices | $0 | Usually **no** — check each source's terms. Fine for a private testnet demo clearly labelled as such. |
| **Third-party API** (Metals-API, Zyla, similar) | LME-referenced prices via REST/JSON | ~$200–$1,000/month | Depends entirely on their terms — must be read before launch. |
| **Official LME distribution licence** | Real-time or 30-min-delayed licensed LME data | ~$25,000/year distribution licence, plus per-subscriber fees; LMElive viewer ~$315/month; LME aims to review applications within ~6 weeks | **Yes** — this is the option that legally permits a public website |
| **Magnesium** (not on LME) | Needs a separate provider: Fastmarkets, Argus, SMM, or similar assessed price | Separate subscription, priced on request | Per their contract |

**Design consequence:** the price engine must treat the data provider as a
swappable plug-in from day one. We write one internal interface, `PriceSource`,
and implement it once for a free demo source and once for the paid source. Then
switching providers is a config change, not a rewrite. This costs almost nothing
to do up front and saves weeks later.

---

## 6. Architecture

```
   LME / data provider APIs        (external, paid, rate-limited)
              |
              v
   +------------------------+
   |   Price Engine         |   polls on a schedule, validates, stores
   |   (Node + TypeScript)  |   - rejects absurd jumps (fat-finger guard)
   |                        |   - keeps full history in PostgreSQL
   |                        |   - computes MCH Index
   +------------------------+
         |              |
         |              +-------> WebSocket push --> Website (live updates)
         |
         v
   +------------------------+
   |   Oracle Submitter     |   signs + posts the Index onto Cardano
   |   (Lucid Evolution)    |   on a heartbeat, or when price moves > X%
   +------------------------+
              |
              v
   +------------------------+
   |   Cardano (preprod     |   Aiken validators:
   |   testnet -> mainnet)  |   - oracle feed validator (holds Index in a datum)
   |                        |   - MCH minting policy
   |                        |   - vault validator (only in Model B / C)
   +------------------------+
              ^
              |  reads via Blockfrost
   +------------------------+
   |   Website (Next.js)    |   chart, basket breakdown, wallet connect
   +------------------------+
```

### Stack, and why

- **TypeScript everywhere off-chain.** Cardano's off-chain tooling (Lucid
  Evolution, MeshJS) is TypeScript-first. Using one language for backend,
  frontend and chain interaction keeps the codebase learnable by one person.
- **PostgreSQL** for price history — it is boring, free, and correct for
  time-series money data. Never store prices as floating point; use integers in
  minor units or exact decimals.
- **Aiken** for the on-chain validators, as requested.
- **Blockfrost** to read and submit to Cardano without running your own node.
- **Monorepo** so the shared Index maths lives in exactly one file, used by
  backend, frontend and oracle alike. One formula, one place, no drift.

---

## 7. Phases

### Phase 0 — Decisions (blocked on you, ~1 day)
Answer the open questions in section 9. Nothing else starts cleanly until the
model (A/B/C), the metal list and the data budget are settled.

### Phase 1 — Price engine + website, test data (1–2 weeks)
- Monorepo scaffold, CI, linting, typed config.
- `PriceSource` interface + one free/demo implementation, clearly labelled.
- Index calculation, fully unit-tested against hand-worked examples.
- PostgreSQL schema + history.
- REST + WebSocket API.
- Website: live Index, per-metal breakdown, historical chart, honest "as of"
  timestamps and a visible "demo data" banner.

**You can see and click this at the end of Phase 1.** That matters — it is the
first thing you can show anyone.

### Phase 2 — Token + oracle on testnet (2–4 weeks)
- Aiken oracle validator; Index posted on-chain on preprod testnet.
- MCH minting policy; token metadata (CIP-68 if the metadata needs to be
  updatable, plain CIP-25-style otherwise).
- Oracle submitter service with retries, and alerting when the feed goes stale —
  a stale oracle is the single most dangerous failure mode in this kind of system.
- Website: wallet connect, read the on-chain Index, see your MCH balance.
- All on test ADA. Costs nothing real. Nothing here can lose money.

### Phase 3 — Choose and build the peg (4–8 weeks, only if Model B or C)
- Vault contracts, mint/redeem flow, over-collateralisation and liquidation
  logic if Model C.
- **Independent security audit before any real value touches it.** Non-negotiable.
- Legal structure, licensing, reserve attestation if Model B.

### Phase 4 — Mainnet + liquidity (timing depends on Phase 3)
- Paid, licensed data feed switched on.
- Mainnet deployment, monitoring, incident runbook.
- DEX liquidity (Minswap / SundaeSwap) so the token can actually trade.
- Optionally move the oracle to a decentralised provider (Charli3 or Orcfax,
  both of which support custom feeds with configurable update intervals and
  deviation triggers) so the project does not depend on one signing key you own.

---

## 8. Risks, stated plainly

| Risk | Why it matters | What we do about it |
|------|----------------|---------------------|
| **Regulatory** | A token designed to track metal prices looks like a security, a derivative, or e-money to most regulators. Jurisdiction decides. | Get a lawyer before mainnet, not after. Keep Phases 1–2 on testnet with no sale of anything. |
| **Data licensing** | Publishing LME prices publicly without a licence is a contract/IP problem, independent of crypto law. | Demo data until the licence is in place; swappable `PriceSource` interface. |
| **Stale oracle** | If the feed dies and the contract keeps using an old price, that is exploitable. | Timestamp every on-chain post; contracts reject data older than a set age; alerting on staleness. |
| **Single oracle key** | If we hold the only signing key, we can move the Index — and so can anyone who steals the key. | Hardware-backed key, then migrate to multi-signer or a decentralised oracle. |
| **No liquidity** | A token nobody trades has no price at all, whatever the Index says. | Plan DEX liquidity before launch, not after. |
| **Smart contract bug** | On-chain bugs are not patchable like websites. Funds leave and do not come back. | Aiken unit + property tests, testnet first, external audit before mainnet. |
| **Magnesium pricing** | No exchange price exists; assessed prices are opaque, infrequent and expensive. | Either swap the metal, or accept a slower-moving assessed price and label it clearly. |

---

## 9. Open questions

Blocking questions are marked **[B]** — work cannot start cleanly without them.

1. **[B] Chain confirmation.** Aiken means Cardano. Deliberate, or just the name
   you came across? *(Recommended default: yes, Cardano + Aiken.)*
2. **[B] Which model — A, B or C?** *(Recommended default: build Model A's shared
   infrastructure on testnet now, decide B vs C at Phase 3 with legal advice.)*
3. **[B] Magnesium.** Not on LME. Options: (a) swap it for an LME metal —
   aluminium, zinc, tin and cobalt are all liquid and cheap to source; (b) keep
   magnesium and buy an assessed price from Fastmarkets/Argus/SMM; (c) ship with
   three metals and add the fourth later. *(Recommended default: (c) build for four
   slots, run Phase 1 with gold/copper/nickel + aluminium as a stand-in, swap
   magnesium in whenever you buy that feed. The code should not care.)*
4. **[B] Data budget right now.** $0 (demo data, testnet, clearly labelled) /
   ~$200–400 per month (third-party API) / full LME licence (~$25k per year)?
   *(Recommended default: $0 for Phases 1–2, licence before mainnet.)*
5. **Weights.** Equal 25% each, or weighted by something else? And what base date?
   *(Recommended default: equal 25% each, base date = the day Phase 1 goes live,
   weights stored in config so they are easy to change.)*
6. **Is this a real product that will take public money, or a demo / learning
   project / investor showcase?** This changes how much rigour and legal work is
   needed, and I should not guess.
7. **Jurisdiction and entity.** Which country are you in, and is there a company,
   or is it just you?
8. **Token specifics.** Ticker `MCH`? Decimals (6 is Cardano convention)? Fixed
   total supply, or minted on demand?
9. **What accounts do you already have?** Cardano wallet (Lace/Eternl) with any
   test ADA, a domain name, hosting, any data-provider account?
10. **Deadline and budget**, if either exists.
