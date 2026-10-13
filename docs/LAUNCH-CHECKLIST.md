# Launch checklist

Mainnet deployment is locked (`npm run chain:deploy` refuses `Mainnet` unless
`MCH_MAINNET_ACKNOWLEDGED=yes`). Unlock it only when every section below is
done. This is a working list, not legal advice.

## 1. Legal (UK): talk to a solicitor first

You said MCH is a real product and you are in the UK. Find a solicitor who
does FCA cryptoasset work and take these questions:

- **Financial promotions.** Since October 2023, promoting a cryptoasset to
  people in the UK (a website or social post counts) generally has to be done
  or approved by an FCA-authorised firm, or by a firm registered with the FCA
  for cryptoassets, and must follow rules on risk warnings, cooling-off
  periods and appropriateness checks. _Who will approve MCH's promotions?_
- **The new cryptoasset regime.** The FCA expects it to take effect on
  **25 October 2027**; its application gateway opened on 30 September 2026.
  The FCA's final admissions and disclosures rules (PS26/9, June 2026)
  prohibit offering qualifying cryptoassets to the public unless a
  qualifying cryptoasset disclosure document has been published.
  _Does selling or listing MCH count as a public offer? Who prepares the
  disclosure document? Does anything about MCH need authorisation, and do we
  need to apply in the current window?_
- **What MCH legally is.** A token designed to track an index of commodity
  prices could be argued to be a security or a derivative (contract for
  differences), not just a cryptoasset. The answer changes everything.
  _How is MCH classified, and would a different design (no issuer
  promises, different marketing) change that?_
- **Company and tax.** A UK company to issue the token, terms of use,
  privacy policy, and the tax treatment of the supply held by the company.
- **Anti-money-laundering.** Whether any planned activity (selling tokens,
  running a swap, holding customer funds) needs FCA registration.

## 2. Data licence

- [ ] Choose a provider (see [DATA-PROVIDERS.md](DATA-PROVIDERS.md)).
- [ ] Written confirmation that the licence covers public display, a derived
      index, and on-chain publication.
- [ ] Implement and test its `PriceSource`; run it on testnet for at least two weeks.
- [ ] Set real base prices and the base date in `config/basket.json`, set
      `isDemo` to `false`, bump `version`.

## 3. Security

- [ ] **Independent audit** of `contracts/` by a Cardano-specialist firm.
- [ ] Admin key on a **hardware wallet** (or a multi-signature setup). Never in a file on a server.
- [ ] Operator key in the host's secret manager, used only by the submitter.
- [ ] Alerts wired to a channel someone watches (`ALERT_WEBHOOK_URL`).
- [ ] A rehearsed incident plan: rotate a leaked operator key, pause updates.

## 4. Token decisions

- [ ] Total supply and decimals (testnet default: 100,000,000 MCH, 6 decimals).
- [ ] Who receives the supply and how it is distributed. Write it down publicly.
- [ ] Logo hosted permanently (IPFS) and set in `TOKEN_LOGO`.
- [ ] Whether to _also_ register metadata in the Cardano Token Registry for
      older wallets.

## 5. Money

- Oracle updates: about **0.26 ADA each**. Hourly heartbeat ≈ 6 ADA/day ≈ 2,200 ADA/year.
  A 6-hour heartbeat with a 1% deviation trigger costs far less.
- One-off: about 5 ADA locked in the feed, about 14 ADA locked forever with
  the reference script, plus a few ADA in fees.
- Data licence: from roughly $200–1,000 a month for a vendor feed to
  $25,000 a year for an LME distribution licence (see the roadmap).
- Liquidity: a token nobody can trade has no price. Budget for providing
  liquidity on a Cardano DEX if that is part of the plan.

## 6. Go-live

- [ ] Website shows no demo banner, and every price carries its source and time.
- [ ] Mainnet deploy, then verify `deployments/mainnet.json` on Cardanoscan.
- [ ] Submitter running, first heartbeats confirmed, alerts tested.
