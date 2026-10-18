# MCH (Metal Chain) — Roadmap

**Last updated:** 2026-10-13

## Decisions so far

| Question     | Decision                                                    | Notes                                                                                    |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Blockchain   | **Cardano**, contracts in **Aiken**                         |                                                                                          |
| Token model  | **A: tracker token**                                        | Fixed supply, not backed, not redeemable. B or C can be added later; see below           |
| Basket       | **Gold, silver, platinum, nickel**                          | Magnesium and copper dropped                                                             |
| Weights      | **25% each** _(assumed, please confirm)_                    | One line in `config/basket.json`                                                         |
| Data budget  | **$0 now** (demo data), **monthly provider later**          |                                                                                          |
| Product      | **Real product, UK**                                        | Legal work is on the critical path: [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) |
| Token supply | **100,000,000 MCH, 6 decimals** _(default, please confirm)_ | **Permanent** once the coin is created on real Cardano                                   |

## What the basket change means

Dropping magnesium removed the hardest data problem (it has no exchange
price at all). But only **nickel** is an LME price; gold, silver and platinum
are London bullion-market prices, and their benchmarks are run by ICE
Benchmark Administration. Platinum's moved there from the LME on 1 July 2026.
Both sources are licensed. Details: [docs/DATA-PROVIDERS.md](docs/DATA-PROVIDERS.md).

## What "Model A" means, in one paragraph

The website and the chain show the MCH Index, and the MCH token exists and
can be traded, but nothing forces the token's market price to equal the
index. Making it follow the index needs one of two designs:
**B**, a company holding real reserves and letting anyone redeem tokens at
the index value (a regulated product), or **C**, users locking crypto
collateral to mint synthetic MCH, with liquidations (complex, audit-heavy).
Everything built so far (index, engine, oracle, website) is needed by B and C
too, so nothing is wasted if you move later. The token itself would need a
new minting design for B or C, because today's supply is fixed forever.

## Status

| Phase | What                                                         | Status                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Index maths, price engine, website                           | **Built.** Runs locally on demo data: `npm run dev`                                                                                                                                                    |
| 2     | Oracle and MCH token contracts, deploy and submitter tooling | **Built and tested** on an emulated Cardano ledger. Testnet deployment is waiting on you: wallets and faucet, about 15 minutes, see [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)                 |
| 3     | Make the token price follow the index (Model B or C)         | Not started: only if you choose B or C                                                                                                                                                                 |
| 4     | Coin on real Cardano; real data, legal, audit                | **The coin can be created now:** [docs/MAINNET-COIN.md](docs/MAINNET-COIN.md). The oracle waits for real prices; selling waits for the checklist: [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) |

### Built so far

- **Index:** exact integer maths shared by backend, website and contract;
  verified against an independent reference and 20,000 random cases.
- **Price engine:** pluggable data sources (demo today), a guard that keeps
  single bad prints out of the index, Postgres storage, REST and WebSocket
  API, alerts.
- **Contracts (Aiken):** an oracle that rejects any update whose index does
  not match its prices, with hot/cold key separation; a fixed-supply CIP-68
  token; 221 contract tests.
- **Chain tooling:** wallet creation, one-command deploy (mainnet locked),
  a submitter that publishes on 0.5% moves or hourly, a status command.
  Updates cost about 0.26 ADA.
- **Website:** live index, basket, history charts, on-chain panel, wallet
  balance, methodology, light and dark themes, works on phones.
- **Delivery:** CI for everything (including a check that the committed
  contract build matches the source), Dockerfile, docker-compose.

## Next steps, in order

1. **You:** run it locally (`npm run dev`) and tell me what to change.
2. **You:** confirm weights (25% each?) and the coin's supply (100M, 6 decimals?).
   The supply is permanent once the coin exists.
3. **You:** create the coin on real Cardano with [docs/MAINNET-COIN.md](docs/MAINNET-COIN.md)
   (coin only; the oracle waits for real prices), or try the test network first
   ([docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)).
4. **You:** book a UK solicitor with crypto/FCA experience; take section 1 of the launch checklist.
   Don't sell or promote the coin before then.
5. **You + me:** choose a data provider; I implement and test its adapter, then add the oracle.
6. **Me:** host the website publicly (needs a hosting account and a domain).
7. **Later:** security audit, liquidity. Moving to Model B or C would mean a new, different coin.
