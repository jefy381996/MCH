# Operations

## Processes

| Process          | Command                           | Notes                                                      |
| ---------------- | --------------------------------- | ---------------------------------------------------------- |
| Website + API    | `npm start` (or the Docker image) | Stateless apart from Postgres; run more than one if needed |
| Oracle submitter | `npm run chain:submitter`         | Exactly **one** instance; it holds the operator key        |

Health: `GET /api/health` returns `degraded` after 5 consecutive failed price
polls. The submitter logs JSON lines and alerts (warning, then critical) on
failures, a stale on-chain feed, a basket mismatch, or a snapshot that fails
re-verification.

## Settings that matter

| Setting              | Default              | Meaning                                                                |
| -------------------- | -------------------- | ---------------------------------------------------------------------- |
| `DEVIATION_PCT`      | 0.5                  | Publish when the live index differs from on-chain by this much         |
| `HEARTBEAT_MINUTES`  | 60                   | Publish at least this often; the feed counts as stale after twice this |
| `SUBMIT_INTERVAL_MS` | 60000                | How often the submitter checks                                         |
| `POLL_INTERVAL_MS`   | 5 s demo / 60 s real | How often the engine asks the price source                             |

## Routine tasks

**Replace the operator key** (lost, leaked, or just rotated): create a new
wallet, fund it, then with the _admin_ wallet call `rotateOperator`
(packages/chain/src/oracle-ops.ts) with the new key hash, and restart the
submitter with the new `OPERATOR_SEED`. Readers of the feed are unaffected.

**Change the basket** (weights, metals or base prices): this is a new index
version. Bump `version` in `config/basket.json`, deploy a new oracle, point
the backend and submitter at the new deployment file, announce it, and close
the old feed with `closeOracle` when nobody depends on it. The submitter
refuses to publish across a version mismatch, so a half-done change cannot
corrupt the feed.

**Check the chain by hand:** `npm run chain:status`.

## Database

Postgres tables: `price_quotes` (every accepted quote), `index_snapshots`
(every computed index with its inputs), `schema_migrations`. Migrations run
automatically at start-up. Back up the database like any other: the history
cannot be re-fetched for free.
