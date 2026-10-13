//// Reading the MCH oracle from another contract.
////
//// The feed lives in exactly one UTxO, marked by the auth NFT
//// (`oracle_policy`, "MCH-ORACLE"). The oracle validator guarantees that NFT
//// can only sit at the oracle script with a well-formed datum, so finding the
//// NFT among a transaction's reference inputs is proof the datum is genuine.
//// Consumers must still check freshness themselves.

use aiken/collection/list
use aiken/interval.{Finite}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Input, ValidityRange}
use mch/types.{OracleDatum}

/// Asset name of the oracle's authentication NFT.
pub const auth_token_name: ByteArray = "MCH-ORACLE"

/// Returns the feed datum from the reference input carrying the auth NFT.
/// Fails if no such reference input exists.
pub fn find_feed(
  reference_inputs: List<Input>,
  oracle_policy: PolicyId,
) -> OracleDatum {
  expect Some(feed_input) = list.find(
    reference_inputs,
    fn(i) {
      assets.quantity_of(i.output.value, oracle_policy, auth_token_name) == 1
    },
  )
  expect InlineDatum(data) = feed_input.output.datum
  expect feed: OracleDatum = data
  feed
}

/// True if the feed was published at most `max_age_ms` before the earliest
/// moment this transaction can be valid. An unbounded lower bound is never fresh.
pub fn is_fresh(
  feed: OracleDatum,
  validity_range: ValidityRange,
  max_age_ms: Int,
) -> Bool {
  when validity_range.lower_bound.bound_type is {
    Finite(lower) -> lower - feed.published_at <= max_age_ms
    _ -> False
  }
}

test fresh_within_max_age() {
  let feed = OracleDatum {
    index: 100_000_000,
    prices: [],
    published_at: 1_000_000,
    sequence: 1,
    basket_version: 1,
    operator: #"",
  }
  and {
    is_fresh(feed, interval.between(1_000_000 + 60_000, 2_000_000), 60_000),
    !is_fresh(feed, interval.between(1_000_000 + 60_001, 2_000_000), 60_000),
    !is_fresh(feed, interval.everything, 60_000),
  }
}
