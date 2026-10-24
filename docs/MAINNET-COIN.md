# Creating the MCH coin on real Cardano

This creates the **MCH coin only**. The price oracle comes later, once real
metal prices are connected; the coin does not depend on it.

**Cost:** about 2 ADA to create the coin: a network fee of about 0.3 ADA,
plus about 1.8 ADA that stays locked with the coin's name record. Buy about
20 ADA, because exchanges have minimum withdrawals and fees.

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
2. **Git:**
   - **Windows:** https://git-scm.com/downloads → download → install (accept the defaults).
   - **Mac:** open Terminal (see below) and type `git --version`. If a box
     offers to install the "command line developer tools", click **Install**
     and wait for it to finish.

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

> **Every time you open a new terminal window** for this guide (for example
> after waiting for your ADA), first type `cd MCH` and press Enter. All the
> commands below only work from inside the MCH folder.

## Step 3 — Switch the project to real Cardano

Create your settings file and open it:

| Windows (Command Prompt) | Mac (Terminal)         |
| ------------------------ | ---------------------- |
| `copy .env.example .env` | `cp .env.example .env` |
| `notepad .env`           | `open -e .env`         |

In the file that opens, find these lines (they are already there) and make
them say exactly this:

```
CARDANO_NETWORK=Mainnet
MCH_MAINNET_ACKNOWLEDGED=yes
TOKEN_NAME=MCH
TOKEN_SUPPLY=100000000
TOKEN_DECIMALS=6
```

**Optional:** to change the display name, ticker or description, find these
lines, **delete the `#` at the start of each one you use**, and change the
text after the `=`:

```
# TOKEN_DISPLAY_NAME=Metal Chain
# TOKEN_TICKER=MCH
# TOKEN_DESCRIPTION=MCH tracks the MCH Index of gold, silver, platinum and nickel. Not backed by metal and not redeemable.
```

Keep the words "Not backed by metal and not redeemable." in the description:
they tell anyone who sees the coin what it is not.

**Logo (optional):** if you already have a logo uploaded somewhere
permanent, find the line `# TOKEN_LOGO=`, delete the `#` at its start, and
put the link after the `=`. The link must start with `https://`, `ipfs://`
or `ar://`. Otherwise leave that line as it is; the logo can be added later.

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
  anyone. You don't need them to see your coins (Step 7). The only place
  you would ever type them is a wallet app installed from its official
  website, and only when you want to send coins. Anyone asking for them is
  a scammer, including someone claiming to be me.

(An "operator" wallet is also created. It is for the oracle later; ignore it for now.)

## Step 5 — Put ADA in the wallet

1. Buy about **20 ADA** on a crypto exchange that is registered with the FCA.
   You can check an exchange on the FCA register: https://register.fca.org.uk
2. Withdraw **15 ADA** to your **admin address** from Step 4, in one
   withdrawal. (At least 10 ADA must arrive; exchanges often take their fee
   from the amount.) Copy and paste the address (never type it), and check
   the first and last few characters match.
3. Wait until it arrives (usually 5–30 minutes). To check, paste your
   address into the search box at https://cardanoscan.io.

## Step 6 — Create the coin

If this is a new terminal window, type `cd MCH` first. Then:

```bash
npm run chain:mint-coin
```

It shows a summary: network, your wallet and balance, the coin's name, the
total supply, the cost, and what is permanent. **Read it.** If everything is
right, type `CREATE` and press Enter. Typing anything else (or pressing
Ctrl+C) at that question stops it, and nothing is sent.

Then you'll see:

```
Creating the MCH coin...
  sent: https://cardanoscan.io/transaction/...
  waiting for the network to confirm it (usually 1-5 minutes)...
  ✔ created, and the record is saved.

Done. Record: ...mainnet.json
  Your coin: https://cardanoscan.io/token/...
  All 100,000,000 coins are in the admin wallet.
  Keep the record file: it is the public record of what you created (guide Step 8).
```

After you type `CREATE`, leave the window open until it says `Done`. The
record is saved before anything is sent, so nothing can get lost. If the
network is slow, or you close the window or press Ctrl+C early, it may say
something starting with ⏳ instead, for example:

```
⏳ The MCH coin was sent, but the network has not confirmed it yet.
```

That's fine. Wait 10 minutes and run `npm run chain:mint-coin` again. It
checks the network and finishes the job. It will **not** create a second
coin. If the network does not show the earlier attempt yet, it says so,
shows the summary again and asks you to type `CREATE` again: that is
expected, and sending it again can only ever make that same coin. If that
then says "Sending the new copy reported a problem", the first copy is
probably still on its way: wait another 10 minutes and run it again.

If it still shows a ⏳ message after an hour, stop and send me the
`Transaction:` link it shows.

## Step 7 — See your coins

- Open the "Your coin" link from Step 6. You'll see the coin, its total
  supply and its **policy id**: its permanent identity on Cardano.
- To see what the admin wallet holds, paste your admin address (Step 4)
  into https://cardanoscan.io. You'll see the 100,000,000 MCH and your ADA.
  This needs no recovery phrase.
- **Only when you want to send coins** do you need a wallet app. Install a
  Cardano wallet **browser extension**, only from its official website:
  - **Lace:** https://www.lace.io
  - **Eternl:** https://eternl.io

  Never install a wallet from an app-store search result or an advert; fake
  wallet apps that steal recovery phrases exist. Choose **"Restore wallet"**
  and enter the 24 words. Your MCH appear (the name and ticker may take a
  few minutes to show).

## Step 8 — Save the record

The file `deployments/mainnet.json` (in the MCH folder) is the public
record of what you created: the coin's identity, not any secret.

**Easiest:** open it (`notepad deployments\mainnet.json` on Windows,
`open -e deployments/mainnet.json` on a Mac) and send me its contents. I'll
add it to the project.

**Or**, if you are comfortable with Git, save it to GitHub yourself. In a new
window, type `cd MCH` first. The first time, tell Git who you are:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git add deployments/mainnet.json
git commit -m "Record the MCH coin on Cardano mainnet"
git pull --no-rebase --no-edit
git push
```

`git push` may open your browser to sign in to GitHub. If instead it asks
for a username and password in the window, stop (press Ctrl+C) and use the
easiest way above.

## Step 9 — Keep it safe

- The paper with the 24 words is the most important thing in this project.
  Keep it safe from fire and water, and consider a second copy in another place.
- Keep `secrets/admin.seed` on your computer for now: it is needed to update
  the coin's name or logo later. Never upload it anywhere. The project
  already stops Git from uploading it.
- For long-term safety, move most of the coins to a hardware wallet
  (Ledger or Trezor) once you have one. Before you do, make sure the record
  is saved (Step 8), and **leave at least 1 MCH at the admin address**. If
  the record were ever lost, that coin is how the program recognises that
  MCH already exists, and refuses to make a second one. After any send,
  paste the admin address into https://cardanoscan.io and check it still
  shows some MCH. (Some wallet apps put the leftover coins at a different
  address of the same wallet; if so, send 1 MCH back to the admin address.)

---

## If something goes wrong

| You see                                                                            | It means                                                             | Do this                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `running scripts is disabled on this system`                                       | You're in PowerShell, which blocks `npm`                             | Use **Command Prompt** instead (Step 1)                                                                                                                                                                                     |
| `Could not read package.json` or `ENOENT`                                          | The window is not in the MCH folder                                  | Type `cd MCH`, then run the command again                                                                                                                                                                                   |
| `Unknown file extension ".ts"`                                                     | Node is too old                                                      | Install the LTS version from nodejs.org (Step 1)                                                                                                                                                                            |
| `Real Cardano (Mainnet) is locked`                                                 | Step 3 isn't done                                                    | Check the two lines in `.env` and save the file                                                                                                                                                                             |
| `CARDANO_NETWORK in .env must be`                                                  | A typing mistake in that line                                        | Make it say `CARDANO_NETWORK=Mainnet` and save the file                                                                                                                                                                     |
| `The admin wallet holds 0 ADA`                                                     | The ADA hasn't arrived, or went to another address                   | Wait, then check the address on cardanoscan.io                                                                                                                                                                              |
| `send it at least 10 ADA first`                                                    | Not enough ADA arrived                                               | Send a few more ADA and run Step 6 again                                                                                                                                                                                    |
| `Could not build the transaction, so nothing was sent`                             | Usually a network hiccup. Nothing was spent                          | Run Step 6 again in a few minutes. If the message mentions "collateral", first send 5 more ADA in one withdrawal. If it keeps happening, send me the message                                                                |
| `TOKEN_LOGO must be a link`                                                        | The logo line in `.env` isn't a proper link                          | Fix it, or put a `#` back at the start of that line                                                                                                                                                                         |
| `Could not reach the Cardano Mainnet network` or `Could not read the admin wallet` | Internet problem, or the free Koios service is busy                  | Try again in a few minutes. Or make a free **Mainnet** project at https://blockfrost.io, then in `.env` change the existing lines to `CARDANO_PROVIDER=blockfrost` and `BLOCKFROST_PROJECT_ID=` followed by your project id |
| Anything starting with `⏳`                                                        | The network is slow, the connection dropped, or it was stopped early | Wait 10 minutes and run `npm run chain:mint-coin` again. It finishes the job and never makes a second coin                                                                                                                  |
| `This needs you to type a confirmation`                                            | The window can't take typing (e.g. Git Bash)                         | Use Command Prompt (Windows) or Terminal (Mac)                                                                                                                                                                              |
| `The MCH coin already exists`                                                      | The coin was already created                                         | Nothing to do: running it again would make a second, different coin, so the program refuses                                                                                                                                 |
| `This wallet already holds a coin`                                                 | The coin exists but the record file is missing or out of date        | Don't create another. Send me the transaction link from when it was created, and I'll rebuild the record                                                                                                                    |
| `Stopped. Nothing was sent.`                                                       | You didn't type `CREATE` exactly, or pressed Ctrl+C                  | Run Step 6 again                                                                                                                                                                                                            |
| `Stopped by an unexpected problem`                                                 | Something outside the program failed (often the record file)         | Read the rest of that message. Fix the problem if you can (for example close the file if it is open), then run Step 6 again. It never makes a second coin                                                                   |

## After the coin exists

- **Show it on the website:** in `.env`, change the existing line
  `ORACLE_DEPLOYMENT_FILE=` to `ORACLE_DEPLOYMENT_FILE=deployments/mainnet.json`,
  then run `npm run dev` and open http://localhost:5173. The token panel
  shows the coin's supply and links, and a connected wallet shows its MCH
  balance.
- **Logo:** upload an image to a permanent host (such as IPFS); I'll add the
  command that updates the coin's logo.
- **Before anyone else gets coins:** the solicitor (sections 1 and 4 of
  [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)).
- **The price oracle:** once a real data provider is connected, run
  `npm run chain:deploy`. It sees the coin already exists and creates only the oracle.
