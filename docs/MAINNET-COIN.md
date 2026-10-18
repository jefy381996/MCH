# Creating the MCH coin on real Cardano

This creates the **MCH coin only**. The price oracle comes later, once real
metal prices are connected; the coin does not depend on it.

**Time:** about 45 minutes, most of it waiting for ADA to arrive.
**Cost:** about 2.7 ADA to create the coin. Buy about 20 ADA, because
exchanges have minimum withdrawals and fees.

> **Creating the coin is not selling it.** Holding it in your own wallet is
> fine. Do not sell it, advertise it, give it away to the public or list it
> on an exchange until a UK solicitor has confirmed how (see
> [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)). The coin's rules have been
> tested thoroughly, but have not yet been checked by an independent
> security firm.

---

## Step 0 — Decide three things. They are permanent.

| Choice                                  | Default                                        | Can it change later?                                 |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Total number of coins                   | 100,000,000                                    | **Never.** No more can ever be created               |
| Decimal places                          | 6 (so 1 MCH can be split into 0.000001)        | Not sensibly: wallets would show wrong amounts       |
| Asset name                              | MCH                                            | **Never**                                            |
| Display name, ticker, description, logo | Metal Chain, MCH, a short description, no logo | Yes (ask me for the update command when you need it) |

If the defaults are fine, you don't need to change anything.

## Step 1 — Install two programs

1. **Node.js 22 or newer:** https://nodejs.org → download the "LTS" version → install.
2. **Git:** https://git-scm.com/downloads → download → install (accept the defaults).

Then open a **terminal**: on Windows, "PowerShell" from the Start menu; on
a Mac, "Terminal" from Spotlight.

## Step 2 — Download the project

Type these one at a time, pressing Enter after each:

```bash
git clone -b claude/mch-metal-chain-token-paf9ps https://github.com/jefy381996/MCH.git
cd MCH
npm install
```

`npm install` takes a minute or two. Warnings are normal; red "ERR!" lines are not.

## Step 3 — Switch the project to real Cardano

```bash
cp .env.example .env
```

Open the new `.env` file in a text editor (Notepad is fine; it is inside the
`MCH` folder). Find these lines and change them to:

```
CARDANO_NETWORK=Mainnet
MCH_MAINNET_ACKNOWLEDGED=yes
TOKEN_SUPPLY=100000000
TOKEN_DECIMALS=6
```

Optional, only if you want something other than the defaults:

```
TOKEN_DISPLAY_NAME=Metal Chain
TOKEN_TICKER=MCH
TOKEN_DESCRIPTION=Your own short description
TOKEN_LOGO=ipfs://...   (a permanent image link, if you already have one)
```

Save the file.

## Step 4 — Create your wallet

```bash
npm run chain:wallets
```

It prints an **admin** address starting with `addr1`. This wallet will hold
all the MCH coins.

Now open the file `secrets/admin.seed` (inside the `MCH` folder). It holds
24 words: the **recovery phrase**.

- **Write the 24 words on paper**, in order, and keep the paper somewhere safe.
- Whoever has these words controls every MCH coin. Never type them into a
  website, never send them to anyone, never photograph them. Anyone who asks
  for them is a scammer, including someone claiming to be me.

(An "operator" wallet is also created. It is for the oracle later; ignore it for now.)

## Step 5 — Put ADA in the wallet

1. Buy about **20 ADA** on a crypto exchange that is registered with the FCA
   (check it on the FCA register: https://register.fca.org.uk).
2. Withdraw **at least 10 ADA** to your **admin address** from Step 4.
   Copy and paste the address, never type it, and check the first and last
   few characters match.
3. Wait until it arrives (usually 5–30 minutes). To check, paste your
   address into the search box at https://cardanoscan.io.

## Step 6 — Create the coin

```bash
npm run chain:mint-coin
```

It shows a summary: network, your wallet and balance, the coin's name, the
total supply, the cost, and what is permanent. **Read it.** If everything is
right, type `CREATE` and press Enter. Anything else stops it, and nothing
is sent.

Then:

```
Creating the MCH coin...
  submitted: https://cardanoscan.io/transaction/...
  waiting for the network to confirm it (usually under a minute)...
  ✔ created. Record saved to .../deployments/mainnet.json
```

**Don't close the terminal while it says "waiting".** If you do by mistake,
don't run the command again. Open the transaction link instead, and send it
to me.

## Step 7 — See your coins

- Open the link printed at the end ("Your coin: https://cardanoscan.io/token/...").
  You'll see the coin, its total supply and its policy id: its permanent
  identity on Cardano.
- To see the coins in a wallet app, install **Eternl** or **Lace** (browser
  extensions), choose **"Restore wallet"**, and enter the 24 words. Your
  100,000,000 MCH appear. The name and ticker may take a few minutes.

## Step 8 — Save the record

The file `deployments/mainnet.json` is the public record of what you
created: the coin's identity, not any secret. Keep it. Either send it to me,
or save it to GitHub:

```bash
git add deployments/mainnet.json
git commit -m "Record the MCH coin on Cardano mainnet"
git push
```

## Step 9 — Keep it safe

- The paper with the 24 words is the most important thing in this project.
  Store it somewhere safe from fire and water, and consider a second copy in
  another place.
- Keep `secrets/admin.seed` on your computer for now: it is needed to update
  the coin's name or logo later. Never upload it anywhere. The project
  already stops Git from uploading it.
- For long-term safety, move most of the coins to a hardware wallet
  (Ledger or Trezor) once you have one.

---

## If something goes wrong

| You see                                                      | It means                                            | Do this                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Real Cardano (Mainnet) is locked`                           | Step 3 isn't done                                   | Check the two lines in `.env` and save the file                                                                                                                         |
| `The admin wallet holds 0 ADA`                               | The ADA hasn't arrived, or went to another address  | Wait, then check the address on cardanoscan.io                                                                                                                          |
| `Could not reach the Cardano network`                        | Internet problem, or the free Koios service is busy | Try again in a few minutes. Or make a free **Mainnet** project at https://blockfrost.io and add `CARDANO_PROVIDER=blockfrost` and `BLOCKFROST_PROJECT_ID=...` to `.env` |
| `The MCH coin already exists` or `already holds an MCH coin` | The coin was already created                        | Nothing to do. Running it again would make a second, different coin, so the program refuses                                                                             |
| `Stopped. Nothing was sent.`                                 | You didn't type `CREATE` exactly                    | Run Step 6 again                                                                                                                                                        |

## After the coin exists

- **Show it on the website:** in `.env` set
  `ORACLE_DEPLOYMENT_FILE=deployments/mainnet.json`, then `npm run dev`. The
  token panel shows the coin's supply and links, and a connected wallet shows
  its MCH balance.
- **Logo:** upload an image to a permanent host (IPFS); I add the
  metadata-update command.
- **Before anyone else gets coins:** the solicitor (sections 1 and 4 of
  [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)).
- **The price oracle:** once a real data provider is connected, run
  `npm run chain:deploy`. It sees the coin already exists and creates only the oracle.
