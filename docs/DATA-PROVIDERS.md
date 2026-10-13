# Price data

## Where each price comes from

| Metal    | Market                                      | Official benchmark        | Benchmark administrator                     |
| -------- | ------------------------------------------- | ------------------------- | ------------------------------------------- |
| Gold     | London bullion market (LBMA)                | LBMA Gold Price           | ICE Benchmark Administration (IBA)          |
| Silver   | London bullion market (LBMA)                | LBMA Silver Price         | IBA                                         |
| Platinum | London platinum and palladium market (LPPM) | LBMA Platinum Price       | IBA, since 1 July 2026 (previously the LME) |
| Nickel   | London Metal Exchange (LME)                 | LME Nickel Official Price | LME                                         |

So only **nickel** is an LME price. Gold, silver and platinum are London
bullion-market prices. Both are licensed products: publishing them on a public
website needs a licence that covers display, either directly from the
LME/IBA or through a data vendor whose contract includes it.

Two kinds of price exist, and the choice matters:

- **Benchmarks** (LBMA Gold Price, LME Official Price) are set once or twice a
  day. Authoritative, slow.
- **Spot/indicative prices** from data vendors update through the trading day.
  "Live", but each vendor's number differs slightly.

## Adding a provider

The engine only talks to the `PriceSource` interface
(`packages/price-engine/src/sources/price-source.ts`). A provider is one class:

1. `fetchLatest(metals)` calls the provider's API and returns one
   `PriceQuote` per metal it has, with:
   - `priceMicro`: USD per troy ounce (gold, silver, platinum) or per tonne
     (nickel), as an integer number of micro-dollars. Use `microFromNumber()`.
     **Convert units here**: some vendors quote nickel per pound or per kg.
   - `observedAt`: the provider's market timestamp, not the request time.
2. Never invent a price. If the provider has nothing for a metal, leave it out.
3. Register it in `createPriceSource()` and add its name to `PRICE_SOURCE` in
   `config.ts`. Keep its API key in an environment variable.
4. Test it against saved real responses, including an error response and a
   response with a missing metal.

The guard, storage, index, API, website and oracle need no changes.

## What to ask a provider before paying

- Which exact series is it (LME nickel cash? 3-month? spot? LBMA benchmark?)
  and in what unit?
- How often does it update, and with what delay?
- **Does the licence allow showing the prices on a public website?** Allow
  deriving and publishing an index from them? Writing that index on a public
  blockchain?
- Rate limits, uptime commitment, and what happens when you exceed them.
- Historical data, for back-filling the chart.
