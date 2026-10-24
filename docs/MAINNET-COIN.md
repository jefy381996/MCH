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
git clone https://github.com/jefy381996/MCH.git
cd MCH
npm install
```

`npm install` takes a minute or two. Lines starting with `npm warn` are
normal, and so is a note about "vulnerabilities" at the end (don't run
`npm audit fix`). Lines starting with `npm error` mean it failed: check your
internet connection and type `npm install` again.

If `git clone` says `destination path 'MCH' already exists`, you already
have a copy. **First check whether it holds a wallet:** type
`dir MCH\secrets` (Windows) or `ls MCH/secrets` (Mac).

- If it lists `admin.seed`, that folder holds your wallet. **Don't rename,
  move or delete it.** Type `cd MCH`, then `git pull` and `npm install`, and
  carry on from the step you had reached.
- If it doesn't list `admin.seed` (for example it says `File Not Found` or
  `No such file or directory`), rename the old copy (`ren MCH MCH-old` on
  Windows, `mv MCH MCH-old` on a Mac) and type the three lines above again.

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

In the file that opens, find these lines (they are already there) and
change them to say exactly this. Change the existing lines; don't paste new
copies of them (the program refuses a file that sets something twice):

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
they tell anyone who sees the coin what it is not. If your text contains a
`#`, put the whole text in double quotes (`TOKEN_DESCRIPTION="..."`):
otherwise everything from the `#` on is ignored.

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
check the `CARDANO_NETWORK` line.) To see this address again later, type
`npm run chain:wallets` again: it shows the same wallet and never replaces it.

Show the wallet's recovery phrase:

| Windows                   | Mac                      |
| ------------------------- | ------------------------ |
| `type secrets\admin.seed` | `cat secrets/admin.seed` |

It prints 24 words: the **recovery phrase**. (Don't open that file in an
editor: one stray key changes the phrase.)

- **Write the 24 words on paper**, in order, and keep the paper somewhere safe.
- Whoever has these words controls every MCH coin. Never type them into a
  website or an email, never photograph them, and never give them to
  anyone. You don't need them to see your coins (Step 7). The only place
  you would ever type them is a wallet app installed from its official
  website, and only when you want to send coins. Anyone asking for them is
  a scammer, including someone claiming to be me.

An "operator" wallet is also shown, second. It is for the price oracle
later: ignore it, and never send ADA to it.

## Step 5 — Put ADA in the wallet

1. Buy about **20 ADA** on a crypto exchange that is registered with the FCA.
   You can check an exchange on the FCA register: https://register.fca.org.uk
2. Withdraw **15 ADA** to your **admin address** (the first address in
   Step 4), in one withdrawal. (At least 10 ADA must arrive; exchanges often take their fee
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
total supply, the cost, and what is permanent. **Read it**, and check that
it says `Asset name   MCH`. If everything is right, type `CREATE` and press
Enter. Typing anything else (or pressing Ctrl+C) at that question stops it,
and nothing is sent. (On Windows, Ctrl+C may be followed by the question
`Terminate batch job (Y/N)?`: type `Y` and press Enter.)

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

If it still shows a ⏳ message after an hour, or three times in a row, stop
and send me the whole message, including the `Transaction:` link.

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

| You see                                                                                                                                                                                                                         | It means                                                                                  | Do this                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `running scripts is disabled on this system`                                                                                                                                                                                    | You're in PowerShell, which blocks `npm`                                                  | Use **Command Prompt** instead (Step 1)                                                                                                                                                                                                                                                    |
| `'node' is not recognized` or `command not found: npm`                                                                                                                                                                          | Node isn't installed, or the window was opened before installing it                       | Close the window and open a new one. If it still says this, install Node again (Step 1)                                                                                                                                                                                                    |
| `destination path 'MCH' already exists`                                                                                                                                                                                         | You already have a copy of the project                                                    | Follow Step 2: check whether it holds a wallet first, and never rename a folder that does                                                                                                                                                                                                  |
| `This computer already made a Mainnet MCH wallet`                                                                                                                                                                               | You already have an MCH wallet on this computer, probably in an older MCH folder          | Use that folder (`cd` into it) instead. Don't make a new wallet; ask me if you can't find it                                                                                                                                                                                               |
| `Your local changes to the following files would be overwritten` (from `git pull`)                                                                                                                                              | A project file was changed on your computer                                               | Type `git checkout -- package-lock.json` (or the file it names), then `git pull` again                                                                                                                                                                                                     |
| `Could not read package.json` or `ENOENT`                                                                                                                                                                                       | The window is not in the MCH folder                                                       | Type `cd MCH`, then run the command again                                                                                                                                                                                                                                                  |
| `Missing script`                                                                                                                                                                                                                | The command was typed slightly wrong                                                      | Type it exactly as in the guide, for example `npm run chain:mint-coin`                                                                                                                                                                                                                     |
| `Cannot find package`                                                                                                                                                                                                           | `npm install` did not finish                                                              | Type `npm install` again, in the MCH folder                                                                                                                                                                                                                                                |
| `Unknown file extension ".ts"`                                                                                                                                                                                                  | Node is too old                                                                           | Install the LTS version from nodejs.org (Step 1)                                                                                                                                                                                                                                           |
| `.env has more than one`                                                                                                                                                                                                        | A setting appears twice in `.env` (often after pasting)                                   | Delete the extra lines it names, keeping the ones from Step 3, and save the file                                                                                                                                                                                                           |
| `Real Cardano (Mainnet) is locked`                                                                                                                                                                                              | Step 3 isn't done                                                                         | Make sure `.env` has the lines `CARDANO_NETWORK=Mainnet` and `MCH_MAINNET_ACKNOWLEDGED=yes`, and save the file                                                                                                                                                                             |
| `CARDANO_NETWORK in .env must be`                                                                                                                                                                                               | A typing mistake in that line                                                             | Make it say `CARDANO_NETWORK=Mainnet` and save the file                                                                                                                                                                                                                                    |
| `CARDANO_PROVIDER in .env must be`                                                                                                                                                                                              | A typing mistake in that line                                                             | Make it say `CARDANO_PROVIDER=koios` (or `blockfrost`) and save the file                                                                                                                                                                                                                   |
| `TOKEN_NAME must be`, `TOKEN_DECIMALS must be` or `must be a whole number`                                                                                                                                                      | A typing mistake in one of the coin lines of `.env`                                       | Make the lines match Step 3 exactly and save the file                                                                                                                                                                                                                                      |
| `no longer a valid recovery phrase`                                                                                                                                                                                             | The recovery phrase file was changed, probably in an editor                               | **Don't** delete it or make a new wallet. Open it (`notepad secrets\admin.seed` or `open -e secrets/admin.seed`), type the 24 words from your paper in order with one space between them, and save it                                                                                      |
| `No admin wallet in this folder`                                                                                                                                                                                                | There is no recovery phrase file in this MCH folder                                       | If you haven't done Step 4 yet, do it now. If you have already sent ADA or created the coin, **don't** make a new wallet: ask me                                                                                                                                                           |
| `This is already running in another window`                                                                                                                                                                                     | Another window is running the same command                                                | Finish or close the other window. If no other window is open, type the `del` or `rm` command it shows, then run Step 6 again                                                                                                                                                               |
| `The admin wallet holds 0 ADA`                                                                                                                                                                                                  | The ADA hasn't arrived, or went to another address                                        | Wait, then check the address on cardanoscan.io. If you sent it to the operator address (the second one in Step 4), it is still yours: don't send more, ask me                                                                                                                              |
| `needs at least 10 ADA`                                                                                                                                                                                                         | Not enough ADA arrived                                                                    | Send the extra amount it names to the admin address, then run Step 6 again                                                                                                                                                                                                                 |
| `Could not build the transaction, so nothing was sent`                                                                                                                                                                          | Usually a network hiccup. Nothing was spent                                               | Run Step 6 again in a few minutes. If the message mentions "collateral", first send 5 more ADA in one withdrawal. If it keeps happening, send me the message                                                                                                                               |
| `TOKEN_LOGO must be a link`                                                                                                                                                                                                     | The logo line in `.env` isn't a proper link                                               | Fix it, or put a `#` back at the start of that line                                                                                                                                                                                                                                        |
| `Could not reach the Cardano Mainnet network` or `Could not read the admin wallet`                                                                                                                                              | Internet problem, the free Koios service is busy, or (with Blockfrost) a wrong project id | Try again in a few minutes. With Blockfrost, copy the project id again from blockfrost.io. Or make a free **Mainnet** project at https://blockfrost.io, then in `.env` change the existing lines to `CARDANO_PROVIDER=blockfrost` and `BLOCKFROST_PROJECT_ID=` followed by your project id |
| `BLOCKFROST_PROJECT_ID in .env must be`                                                                                                                                                                                         | The Blockfrost project id is missing, or is for a test network                            | Use the id of a **Mainnet** project from blockfrost.io (it starts with `mainnet`)                                                                                                                                                                                                          |
| `Could not save the record file`                                                                                                                                                                                                | Another program has the record file open, or the folder is read-only                      | Close any program that has `deployments/mainnet.json` open, then run Step 6 again. Nothing was sent                                                                                                                                                                                        |
| Anything starting with `⏳` (it may show as a box on Windows), such as `was sent, but the network has not confirmed it yet`, `Sending reported a problem`, `Sending the new copy reported a problem` or `Stopped while working` | The network is slow, the connection dropped, or it was stopped early                      | Wait 10 minutes and run `npm run chain:mint-coin` again. It finishes the job and never makes a second coin                                                                                                                                                                                 |
| `This needs you to type a confirmation`                                                                                                                                                                                         | The window can't take typing (e.g. Git Bash)                                              | Use Command Prompt (Windows) or Terminal (Mac)                                                                                                                                                                                                                                             |
| `The MCH coin already exists`                                                                                                                                                                                                   | The coin was already created                                                              | Nothing to do: running it again would make a second, different coin, so the program refuses                                                                                                                                                                                                |
| `This wallet already holds a coin`                                                                                                                                                                                              | The coin exists but the record file is missing or out of date                             | Don't create another. Send me the transaction link from when it was created, and I'll rebuild the record. If you never created a coin, someone may have sent you one: send me the message                                                                                                  |
| `could not be read`                                                                                                                                                                                                             | The record file is damaged                                                                | **Don't** delete it. Send it to me as it is                                                                                                                                                                                                                                                |
| `different admin wallet`                                                                                                                                                                                                        | `secrets/admin.seed` is not the wallet the earlier attempt used                           | Put back the 24 words of the wallet you used before (from your paper), or ask me                                                                                                                                                                                                           |
| `Stopped. Nothing was sent.`                                                                                                                                                                                                    | You didn't type `CREATE` exactly, or pressed Ctrl+C at that question                      | Run Step 6 again                                                                                                                                                                                                                                                                           |
| `Stopped. Nothing new was sent`                                                                                                                                                                                                 | You chose not to resend an earlier attempt, which may still reach the network             | Wait 10 minutes and run Step 6 again                                                                                                                                                                                                                                                       |
| `Stopped by an unexpected problem`                                                                                                                                                                                              | Something outside the program failed                                                      | Read the rest of that message. Fix the problem if you can, then run Step 6 again. It never makes a second coin                                                                                                                                                                             |

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
