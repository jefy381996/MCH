# Creating the MCH coin on real Cardano

This creates the **MCH coin only**. The price oracle comes later, once real
metal prices are connected; the coin does not depend on it.

**Cost:** about 2.7 ADA to create the coin. Buy about 20 ADA, because
exchanges have minimum withdrawals and fees.

**Time:** about 45 minutes once you have ADA. If you have never bought
crypto before, start a day or two early: UK rules make a new exchange
customer answer some questions and then wait **at least 24 hours** before
their first purchase.

> **Creating the coin is not selling it.** Holding it in your own wallet is
> fine. Do not sell it, advertise it, give it away to the public or list it
> on an exchange until a UK solicitor has confirmed how (see
> [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)). The coin's rules have been
> tested thoroughly, but have not yet been checked by an independent
> security firm.

---

## Step 0 — Decide three things. They are permanent.

| Choice                                  | Default                                        | Can it change later?                                        |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Total number of coins                   | 100,000,000                                    | **Never.** No more can ever be created                      |
| Decimal places                          | 6 (so 1 MCH can be split into 0.000001)        | Not sensibly: wallets would show wrong amounts              |
| Asset name                              | MCH                                            | **Never**                                                   |
| Display name, ticker, description, logo | Metal Chain, MCH, a short description, no logo | Yes, later (ask me for the update command when you need it) |

This is the **fixed-supply tracker coin** ("Model A"). If you later decide
MCH should be backed by real metal or by collateral (Models B or C in the
roadmap), that will need a new, different coin.

If the defaults are fine, you don't need to change anything.

## Step 1 — Install two programs

1. **Node.js:** https://nodejs.org → download the **LTS** version → install.
2. **Git:** https://git-scm.com/downloads → download → install (accept the defaults).

Then open a terminal window:

- **Windows:** open the Start menu, type **Command Prompt**, and open it.
  (Use Command Prompt rather than PowerShell; PowerShell blocks `npm` on
  many PCs.)
- **Mac:** press Cmd+Space, type **Terminal**, and open it.

Check Node is new enough:

```bash
node --version
```

It must say **v22.18** or higher (v24 is fine). If it's lower, install the LTS
version from nodejs.org again.

## Step 2 — Download the project

Type these one at a time, pressing Enter after each:

```bash
git clone -b claude/mch-metal-chain-token-paf9ps https://github.com/jefy381996/MCH.git
cd MCH
npm install
```

`npm install` takes a minute or two. Warnings are normal; red `ERR!` lines
are not.

The project is now in a folder called **MCH** inside your home folder
(`C:\Users\<your name>\MCH` on Windows, `/Users/<your name>/MCH` on a Mac).
All the remaining commands are typed in this same window.

## Step 3 — Switch the project to real Cardano

Create your settings file and open it:

| Windows (Command Prompt) | Mac (Terminal)         |
| ------------------------ | ---------------------- |
| `copy .env.example .env` | `cp .env.example .env` |
| `notepad .env`           | `open -e .env`         |

In the file that opens, find these lines and make them say exactly this:

```
CARDANO_NETWORK=Mainnet
MCH_MAINNET_ACKNOWLEDGED=yes
TOKEN_NAME=MCH
TOKEN_SUPPLY=100000000
TOKEN_DECIMALS=6
```

**Optional:** to change the display name, ticker or description, find these
lines, **delete the `#` at the start of each one you use**, and type your
own text after the `=`:

```
TOKEN_DISPLAY_NAME=Metal Chain
TOKEN_TICKER=MCH
TOKEN_DESCRIPTION=MCH tracks the MCH Index of gold, silver, platinum and nickel.
```

If you already have a logo uploaded somewhere permanent, set
`TOKEN_LOGO=` to its link. It must start with `https://`, `ipfs://` or
`ar://`. Otherwise leave it as it is; the logo can be added later.

Save the file and close the editor.

## Step 4 — Create your wallet

```bash
npm run chain:wallets
```

It prints an **admin** address starting with `addr1`. This wallet will hold
all the MCH coins. (If it starts with `addr_test1`, Step 3 wasn't saved:
check the `CARDANO_NETWORK` line.)

Open the file holding the wallet's recovery phrase:

| Windows                      | Mac                          |
| ---------------------------- | ---------------------------- |
| `notepad secrets\admin.seed` | `open -e secrets/admin.seed` |

It holds 24 words: the **recovery phrase**.

- **Write the 24 words on paper**, in order, and keep the paper somewhere safe.
- Whoever has these words controls every MCH coin. Never type them into a
  website or an email, never photograph them, and never give them to
  anyone. The only place you should ever type them is the Eternl or Lace
  wallet in Step 7, installed from the official link given there. Anyone
  asking for them is a scammer, including someone claiming to be me.

(An "operator" wallet is also created. It is for the oracle later; ignore it for now.)

## Step 5 — Put ADA in the wallet

1. Buy about **20 ADA** on a crypto exchange that is registered with the FCA.
   You can check an exchange on the FCA register: https://register.fca.org.uk
2. Withdraw **at least 10 ADA** to your **admin address** from Step 4.
   Copy and paste the address (never type it), and check the first and last
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

Then you'll see:

```
Creating the MCH coin...
  sent: https://cardanoscan.io/transaction/...
  waiting for the network to confirm it (usually 1-5 minutes)...
  ✔ created, and the record is saved.

Done. Record: ...MCH/deployments/mainnet.json
  Your coin: https://cardanoscan.io/token/...
  All 100,000,000 coins are in the admin wallet.
```

The record is saved before anything is sent, so nothing can get lost. If
the network is slow, the program may say instead:

```
⏳ The MCH coin was sent, but the network has not confirmed it yet.
```

That's fine. Wait 10 minutes and run `npm run chain:mint-coin` again. It
checks the network and finishes the job. It will **not** create a second
coin.

## Step 7 — See your coins

- Open the "Your coin" link from Step 6. You'll see the coin, its total
  supply and its **policy id**: its permanent identity on Cardano.
- To see the coins in a wallet, install a Cardano wallet **browser
  extension**, only from its official website:
  - **Lace:** https://www.lace.io
  - **Eternl:** https://eternl.io

  Never install a wallet from an app-store search result or an advert; fake
  wallet apps that steal recovery phrases exist. Choose **"Restore wallet"**
  and enter the 24 words. Your 100,000,000 MCH appear. The name and ticker
  may take a few minutes to show.

## Step 8 — Save the record

The file `deployments/mainnet.json` (in the MCH folder) is the public
record of what you created: the coin's identity, not any secret.

**Easiest:** send me its contents, and I'll add it to the project.

**Or** save it to GitHub yourself. The first time, tell Git who you are:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git add deployments/mainnet.json
git commit -m "Record the MCH coin on Cardano mainnet"
git push
```

`git push` may ask you to sign in to GitHub in your browser.

## Step 9 — Keep it safe

- The paper with the 24 words is the most important thing in this project.
  Keep it safe from fire and water, and consider a second copy in another place.
- Keep `secrets/admin.seed` on your computer for now: it is needed to update
  the coin's name or logo later. Never upload it anywhere. The project
  already stops Git from uploading it.
- For long-term safety, move most of the coins to a hardware wallet
  (Ledger or Trezor) once you have one. **Keep the record file from Step 8
  safe too.**

---

## If something goes wrong

| You see                                                                                 | It means                                                     | Do this                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `running scripts is disabled on this system`                                            | You're in PowerShell, which blocks `npm`                     | Use **Command Prompt** instead (Step 1)                                                                                                                                 |
| `Unknown file extension ".ts"`                                                          | Node is too old                                              | Install the LTS version from nodejs.org (Step 1)                                                                                                                        |
| `Real Cardano (Mainnet) is locked`                                                      | Step 3 isn't done                                            | Check the two lines in `.env` and save the file                                                                                                                         |
| `The admin wallet holds 0 ADA`                                                          | The ADA hasn't arrived, or went to another address           | Wait, then check the address on cardanoscan.io                                                                                                                          |
| `send it at least 10 ADA first`                                                         | Not enough ADA for the coin's minimum amounts                | Send a few more ADA and run Step 6 again                                                                                                                                |
| `Could not build the transaction, so nothing was sent`                                  | Usually not enough ADA                                       | Send more ADA, then run Step 6 again. Nothing was spent                                                                                                                 |
| `TOKEN_LOGO must be a link`                                                             | The logo line in `.env` isn't a proper link                  | Fix it, or put a `#` back at the start of that line                                                                                                                     |
| `Could not reach the Cardano Mainnet network`                                           | Internet problem, or the free Koios service is busy          | Try again in a few minutes. Or make a free **Mainnet** project at https://blockfrost.io and add `CARDANO_PROVIDER=blockfrost` and `BLOCKFROST_PROJECT_ID=...` to `.env` |
| `⏳ ... sent, but the network has not confirmed it yet` or `Sending reported a problem` | The network is slow, or the connection dropped while sending | Wait 10 minutes and run `npm run chain:mint-coin` again. It finishes the job and never makes a second coin                                                              |
| `This needs you to type a confirmation`                                                 | The window can't take typing (e.g. Git Bash)                 | Use Command Prompt (Windows) or Terminal (Mac)                                                                                                                          |
| `The MCH coin already exists`                                                           | The coin was already created                                 | Nothing to do: running it again would make a second, different coin, so the program refuses                                                                             |
| `This wallet already holds an MCH coin`                                                 | The coin exists but the record file is missing               | Don't create another. Send me the transaction link from when it was created, and I'll rebuild the record                                                                |
| `Stopped. Nothing was sent.`                                                            | You didn't type `CREATE` exactly                             | Run Step 6 again                                                                                                                                                        |

## After the coin exists

- **Show it on the website:** in `.env` set
  `ORACLE_DEPLOYMENT_FILE=deployments/mainnet.json`, then run `npm run dev`
  and open http://localhost:5173. The token panel shows the coin's supply and
  links, and a connected wallet shows its MCH balance.
- **Logo:** upload an image to a permanent host (such as IPFS); I'll add the
  command that updates the coin's logo.
- **Before anyone else gets coins:** the solicitor (sections 1 and 4 of
  [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)).
- **The price oracle:** once a real data provider is connected, run
  `npm run chain:deploy`. It sees the coin already exists and creates only the oracle.
