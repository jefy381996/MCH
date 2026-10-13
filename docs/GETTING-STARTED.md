# Getting started

Written for someone new to all of this. Each step says what it does and why.

## 1. Run the website on your computer

1. Install **Node.js 22 or newer** from https://nodejs.org (the "LTS" button).
2. Get the code: `git clone https://github.com/jefy381996/MCH.git`, then `cd MCH`.
3. Install the project's libraries: `npm install` (takes a minute).
4. Start everything: `npm run dev`.
5. Open **http://localhost:5173** in your browser.

What you are looking at: the backend is generating **simulated** prices
(the yellow "Demo data" banner says so), computing the MCH Index every few
seconds, and pushing it to the page. Nothing is on a blockchain yet, and no
money is involved.

To stop it, press `Ctrl+C` in the terminal.

### Optional: keep history between restarts

By default prices live in memory and disappear when you stop the backend.
To keep them, run Postgres. The simplest way is Docker Desktop:

```bash
docker compose up db -d
cp .env.example .env
# in .env, set: DATABASE_URL=postgres://mch:mch@localhost:5432/mch
npm run dev
```

## 2. Put the oracle and token on Cardano's test network

The test network ("Preprod") works exactly like the real one, but its ADA is
free and worthless. This is where everything should be tried first.

1. **Create two wallets.**

   ```bash
   npm run chain:wallets
   ```
   - The **admin** wallet is the "owner" key: it creates the oracle and the
     token, and can replace the operator key if it is ever lost or stolen.
   - The **operator** wallet signs the regular price updates. It runs on a
     server, so it is kept separate from the admin key on purpose.

   The secret recovery phrases are saved in the `secrets/` folder. That
   folder is never uploaded to GitHub. **Back these files up.**

2. **Get free test ADA.** Open https://docs.cardano.org/cardano-testnets/tools/faucet,
   choose **Preprod**, and paste each address the command printed. Send at
   least 100 test ADA to the admin and 50 to the operator.

3. **Deploy.** With the backend running in another terminal (`npm run dev`):

   ```bash
   PRICE_API_URL=http://localhost:8080 npm run chain:deploy
   ```

   This creates the oracle feed with today's index, publishes its script
   for cheap reuse, and mints the fixed supply of MCH to the admin wallet.
   It writes `deployments/preprod.json` and prints links to the
   transactions on Cardanoscan.

4. **Show it on the website.** In `.env`, set
   `ORACLE_DEPLOYMENT_FILE=deployments/preprod.json` and restart
   `npm run dev`. The "On the Cardano blockchain" panel fills in.

5. **Keep the chain up to date.** In a third terminal:

   ```bash
   npm run chain:submitter
   ```

   It publishes a new on-chain value when the index moves by 0.5% or at
   least every hour (both configurable in `.env`). Each update costs about
   0.26 test ADA.

6. **See your tokens.** Install a Cardano wallet browser extension (Lace or
   Eternl), restore the _admin_ recovery phrase into it, switch it to
   Preprod, and press "Connect" in the website's token panel.

If a command says it cannot reach the Cardano network, the free Koios
service may be busy. Create a free project at https://blockfrost.io (choose
Preprod), then set `CARDANO_PROVIDER=blockfrost` and
`BLOCKFROST_PROJECT_ID=...` in `.env`.

## 3. Put the website online

Any host that can run a Docker container next to a Postgres database works.
The repository's `Dockerfile` builds one image that serves both the API and
the website on port 8080. Set `DATABASE_URL` (and later
`ORACLE_DEPLOYMENT_FILE`) as environment variables on the host.

Run the oracle submitter as a **separate** service from the same image
(`node packages/chain/scripts/submitter.ts`) with `OPERATOR_SEED` stored as
a secret. Keeping the signing key out of the public web server limits the
damage if the website is ever compromised.

## 4. Before going live for real

Stop here until the items in [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) are
done. Mainnet deployment is deliberately locked until then.
