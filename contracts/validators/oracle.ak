//// The MCH index oracle.
////
//// One UTxO at this script holds the auth NFT and the latest index as an
//// inline datum. Anyone can read it (as a reference input). Only the operator
//// key can update it, and every update must:
////
////   - increase the sequence number by exactly one,
////   - carry a strictly later `published_at`, inside the transaction's
////     validity range, which may be at most `max_validity_ms` wide,
////   - carry an index equal to the index recomputed from its own prices,
////   - keep the auth NFT at this script with nothing but ADA beside it.
////
//// The admin (a cold key) creates and closes the feed and can replace a
//// compromised operator key without disturbing anyone reading the feed.

use aiken/collection/dict
use aiken/collection/list
use aiken/interval
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Output, OutputReference, Transaction, ValidityRange,
}
use mch/feed.{auth_token_name}
use mch/index_math
use mch/types.{
  Close, Component, Create, Destroy, OracleDatum, OracleMint, OracleSettings,
  OracleSpend, RotateOperator, Update,
}

validator oracle(settings: OracleSettings) {
  mint(redeemer: OracleMint, policy_id: PolicyId, self: Transaction) {
    let minted = dict.to_pairs(assets.tokens(self.mint, policy_id))
    when redeemer is {
      Create -> {
        expect [output] = outputs_holding_auth(self.outputs, policy_id)
        let genesis = feed_datum(output)
        and {
          list.has(self.extra_signatories, settings.admin),
          list.any(self.inputs, fn(i) { i.output_reference == settings.seed }),
          minted == [Pair(auth_token_name, 1)],
          index_math.is_valid_basket(settings.basket),
          settings.max_validity_ms > 0,
          output.address.payment_credential == Script(policy_id),
          holds_only_ada_and_auth(output, policy_id),
          genesis.sequence == 0,
          is_valid_publication(genesis, settings, self.validity_range),
        }
      }
      Destroy -> and {
          list.has(self.extra_signatories, settings.admin),
          minted == [Pair(auth_token_name, -1)],
        }
    }
  }

  spend(
    datum: Option<OracleDatum>,
    redeemer: OracleSpend,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(current) = datum
    expect Some(own_input) = transaction.find_input(self.inputs, own_ref)
    let own_credential = own_input.output.address.payment_credential
    // Spend and mint share one script, so our script hash is the auth policy.
    expect Script(policy_id) = own_credential
    let holds_auth = assets.quantity_of(
      own_input.output.value,
      policy_id,
      auth_token_name,
    ) == 1
    when redeemer is {
      Update -> {
        expect [output] = outputs_holding_auth(self.outputs, policy_id)
        let next = feed_datum(output)
        and {
          holds_auth,
          list.has(self.extra_signatories, current.operator),
          output.address.payment_credential == own_credential,
          holds_only_ada_and_auth(output, policy_id),
          dict.is_empty(assets.tokens(self.mint, policy_id)),
          next.sequence == current.sequence + 1,
          next.published_at > current.published_at,
          next.operator == current.operator,
          is_valid_publication(next, settings, self.validity_range),
        }
      }
      RotateOperator { new_operator } -> {
        expect [output] = outputs_holding_auth(self.outputs, policy_id)
        and {
          holds_auth,
          list.has(self.extra_signatories, settings.admin),
          output.address.payment_credential == own_credential,
          holds_only_ada_and_auth(output, policy_id),
          dict.is_empty(assets.tokens(self.mint, policy_id)),
          feed_datum(output) == OracleDatum {
            ..current,
            operator: new_operator,
          },
        }
      }
      Close -> and {
          list.has(self.extra_signatories, settings.admin),
          if holds_auth {
            // Closing the feed destroys the NFT, so it can never reappear.
            assets.quantity_of(self.mint, policy_id, auth_token_name) == -1
          } else {
            True
          },
        }
    }
  }

  else(_) {
    fail
  }
}

fn outputs_holding_auth(
  outputs: List<Output>,
  policy_id: PolicyId,
) -> List<Output> {
  list.filter(
    outputs,
    fn(o) { assets.quantity_of(o.value, policy_id, auth_token_name) > 0 },
  )
}

fn holds_only_ada_and_auth(output: Output, policy_id: PolicyId) -> Bool {
  assets.flatten(assets.without_lovelace(output.value)) == [
    (policy_id, auth_token_name, 1),
  ]
}

fn feed_datum(output: Output) -> OracleDatum {
  expect InlineDatum(data) = output.datum
  expect feed: OracleDatum = data
  feed
}

fn is_valid_publication(
  feed: OracleDatum,
  settings: OracleSettings,
  range: ValidityRange,
) -> Bool {
  when (range.lower_bound.bound_type, range.upper_bound.bound_type) is {
    (interval.Finite(lower), interval.Finite(upper)) -> and {
        upper - lower <= settings.max_validity_ms,
        interval.contains(range, feed.published_at),
        feed.basket_version == settings.basket_version,
        feed.index == index_math.compute_index(settings.basket, feed.prices),
      }
    _ -> False
  }
}

// ---------------------------------------------------------------------------
// Tests. Fixtures model a realistic update and then break one rule at a time.
// ---------------------------------------------------------------------------

const admin = #"aa000000000000000000000000000000000000000000000000000001"

const operator = #"bb000000000000000000000000000000000000000000000000000002"

const stranger = #"cc000000000000000000000000000000000000000000000000000003"

const policy = #"dd000000000000000000000000000000000000000000000000000004"

const seed =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000001",
    output_index: 0,
  }

const own_ref =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000002",
    output_index: 0,
  }

const basket =
  [
    Component { metal: "XAU", weight_ppm: 250_000, base_price: 4_000_000_000 },
    Component { metal: "XAG", weight_ppm: 250_000, base_price: 48_000_000 },
    Component { metal: "XPT", weight_ppm: 250_000, base_price: 1_600_000_000 },
    Component { metal: "NI", weight_ppm: 250_000, base_price: 15_500_000_000 },
  ]

const settings =
  OracleSettings {
    admin,
    seed,
    basket_version: 1,
    basket,
    max_validity_ms: 600_000,
  }

const t0 = 1_760_000_000_000

const base_prices = [4_000_000_000, 48_000_000, 1_600_000_000, 15_500_000_000]

// Roadmap example: +10%, -5%, +2%, flat -> 101.75
const moved_prices = [4_400_000_000, 45_600_000, 1_632_000_000, 15_500_000_000]

fn feed(
  sequence: Int,
  published_at: Int,
  prices: List<Int>,
  index: Int,
) -> OracleDatum {
  OracleDatum {
    index,
    prices,
    published_at,
    sequence,
    basket_version: 1,
    operator,
  }
}

fn feed_output(datum: OracleDatum) -> Output {
  Output {
    address: address.from_script(policy),
    value: assets.from_lovelace(5_000_000)
      |> assets.add(policy, auth_token_name, 1),
    datum: InlineDatum(datum),
    reference_script: None,
  }
}

fn update_tx(next: Output, signer: ByteArray) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      transaction.Input {
        output_reference: own_ref,
        output: feed_output(feed(0, t0, base_prices, 100_000_000)),
      },
    ],
    outputs: [next],
    extra_signatories: [signer],
    validity_range: interval.between(t0 + 60_000, t0 + 300_000),
  }
}

fn spend_update(tx: Transaction) -> Bool {
  oracle.spend(
    settings,
    Some(feed(0, t0, base_prices, 100_000_000)),
    Update,
    own_ref,
    tx,
  )
}

fn good_next() -> OracleDatum {
  feed(1, t0 + 120_000, moved_prices, 101_750_000)
}

test update_accepted() {
  spend_update(update_tx(feed_output(good_next()), operator))
}

test update_requires_operator_signature() fail {
  spend_update(update_tx(feed_output(good_next()), stranger))
}

test update_rejects_admin_as_operator() fail {
  // The cold key cannot publish prices; separation of duties.
  spend_update(update_tx(feed_output(good_next()), admin))
}

test update_rejects_wrong_index() fail {
  spend_update(
    update_tx(
      feed_output(feed(1, t0 + 120_000, moved_prices, 101_750_001)),
      operator,
    ),
  )
}

test update_rejects_skipped_sequence() fail {
  spend_update(
    update_tx(
      feed_output(feed(2, t0 + 120_000, moved_prices, 101_750_000)),
      operator,
    ),
  )
}

test update_rejects_replayed_sequence() fail {
  spend_update(
    update_tx(
      feed_output(feed(0, t0 + 120_000, moved_prices, 101_750_000)),
      operator,
    ),
  )
}

test update_rejects_non_increasing_timestamp() fail {
  // Current datum and update share a timestamp that is inside the validity
  // range, so the only rule broken is "strictly later than the last update".
  let at = t0 + 120_000
  let current = feed(0, at, base_prices, 100_000_000)
  let tx = Transaction {
    ..update_tx(feed_output(feed(1, at, moved_prices, 101_750_000)), operator),
    inputs: [
      transaction.Input {
        output_reference: own_ref,
        output: feed_output(current),
      },
    ],
  }
  oracle.spend(settings, Some(current), Update, own_ref, tx)
}

test update_accepted_one_millisecond_later() {
  // Control for the test above: same setup, timestamp 1 ms later, accepted.
  let at = t0 + 120_000
  let current = feed(0, at, base_prices, 100_000_000)
  let tx = Transaction {
    ..update_tx(
      feed_output(feed(1, at + 1, moved_prices, 101_750_000)),
      operator,
    ),
    inputs: [
      transaction.Input {
        output_reference: own_ref,
        output: feed_output(current),
      },
    ],
  }
  oracle.spend(settings, Some(current), Update, own_ref, tx)
}

test update_rejects_timestamp_outside_validity_range() fail {
  spend_update(
    update_tx(
      feed_output(feed(1, t0 + 400_000, moved_prices, 101_750_000)),
      operator,
    ),
  )
}

test update_rejects_overly_wide_validity_range() fail {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), operator),
    validity_range: interval.between(t0 + 60_000, t0 + 60_000 + 600_001),
  }
  spend_update(tx)
}

test update_rejects_unbounded_validity_range() fail {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), operator),
    validity_range: interval.after(t0 + 60_000),
  }
  spend_update(tx)
}

test update_rejects_wrong_basket_version() fail {
  let next = OracleDatum { ..good_next(), basket_version: 2 }
  spend_update(update_tx(feed_output(next), operator))
}

test update_rejects_operator_self_rotation() fail {
  let next = OracleDatum { ..good_next(), operator: stranger }
  spend_update(update_tx(feed_output(next), operator))
}

test update_rejects_missing_price() fail {
  spend_update(
    update_tx(
      feed_output(
        feed(
          1,
          t0 + 120_000,
          [4_400_000_000, 45_600_000, 1_632_000_000],
          101_750_000,
        ),
      ),
      operator,
    ),
  )
}

test update_rejects_nft_sent_elsewhere() fail {
  let stolen = Output {
    ..feed_output(good_next()),
    address: address.from_verification_key(operator),
  }
  spend_update(update_tx(stolen, operator))
}

test update_rejects_extra_tokens_beside_nft() fail {
  let out = feed_output(good_next())
  let bloated = Output { ..out, value: assets.add(out.value, #"ee", "junk", 1) }
  spend_update(update_tx(bloated, operator))
}

test update_rejects_minting_under_oracle_policy() fail {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), operator),
    mint: assets.from_asset(policy, auth_token_name, 1),
  }
  spend_update(tx)
}

test update_rejects_spending_utxo_without_nft() fail {
  let garbage = Output {
    ..feed_output(feed(0, t0, base_prices, 100_000_000)),
    value: assets.from_lovelace(2_000_000),
  }
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), operator),
    inputs: [transaction.Input { output_reference: own_ref, output: garbage }],
  }
  spend_update(tx)
}

test rotate_operator_by_admin() {
  let current = feed(0, t0, base_prices, 100_000_000)
  let rotated = OracleDatum { ..current, operator: stranger }
  oracle.spend(
    settings,
    Some(current),
    RotateOperator { new_operator: stranger },
    own_ref,
    update_tx(feed_output(rotated), admin),
  )
}

test rotate_operator_rejects_price_change() fail {
  let current = feed(0, t0, base_prices, 100_000_000)
  let sneaky = OracleDatum { ..good_next(), operator: stranger }
  oracle.spend(
    settings,
    Some(current),
    RotateOperator { new_operator: stranger },
    own_ref,
    update_tx(feed_output(sneaky), admin),
  )
}

test rotate_operator_requires_admin() fail {
  let current = feed(0, t0, base_prices, 100_000_000)
  oracle.spend(
    settings,
    Some(current),
    RotateOperator { new_operator: stranger },
    own_ref,
    update_tx(
      feed_output(OracleDatum { ..current, operator: stranger }),
      operator,
    ),
  )
}

fn create_tx(out: Output, signer: ByteArray, spends_seed: Bool) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: if spends_seed {
      [
        transaction.Input {
          output_reference: seed,
          output: Output {
            address: address.from_verification_key(admin),
            value: assets.from_lovelace(100_000_000),
            datum: transaction.NoDatum,
            reference_script: None,
          },
        },
      ]
    } else {
      []
    },
    outputs: [out],
    mint: assets.from_asset(policy, auth_token_name, 1),
    extra_signatories: [signer],
    validity_range: interval.between(t0 - 60_000, t0 + 60_000),
  }
}

test create_accepted() {
  oracle.mint(
    settings,
    Create,
    policy,
    create_tx(feed_output(feed(0, t0, base_prices, 100_000_000)), admin, True),
  )
}

test create_requires_seed() fail {
  oracle.mint(
    settings,
    Create,
    policy,
    create_tx(feed_output(feed(0, t0, base_prices, 100_000_000)), admin, False),
  )
}

test create_requires_admin() fail {
  oracle.mint(
    settings,
    Create,
    policy,
    create_tx(
      feed_output(feed(0, t0, base_prices, 100_000_000)),
      operator,
      True,
    ),
  )
}

test create_rejects_two_nfts() fail {
  let tx = Transaction {
    ..create_tx(feed_output(feed(0, t0, base_prices, 100_000_000)), admin, True),
    mint: assets.from_asset(policy, auth_token_name, 2),
  }
  oracle.mint(settings, Create, policy, tx)
}

test create_rejects_nonzero_genesis_sequence() fail {
  oracle.mint(
    settings,
    Create,
    policy,
    create_tx(feed_output(feed(5, t0, base_prices, 100_000_000)), admin, True),
  )
}

test create_rejects_invalid_basket() fail {
  let bad = OracleSettings {
    ..settings,
    basket: [
      Component { metal: "XAU", weight_ppm: 900_000, base_price: 4_000_000_000 },
    ],
  }
  oracle.mint(
    bad,
    Create,
    policy,
    create_tx(
      feed_output(feed(0, t0, [4_000_000_000], 90_000_000)),
      admin,
      True,
    ),
  )
}

test close_burns_nft() {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), admin),
    outputs: [],
    mint: assets.from_asset(policy, auth_token_name, -1),
  }
  and {
    oracle.spend(
      settings,
      Some(feed(0, t0, base_prices, 100_000_000)),
      Close,
      own_ref,
      tx,
    ),
    oracle.mint(settings, Destroy, policy, tx),
  }
}

test close_without_burning_nft_rejected() fail {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), admin),
    outputs: [],
  }
  oracle.spend(
    settings,
    Some(feed(0, t0, base_prices, 100_000_000)),
    Close,
    own_ref,
    tx,
  )
}

test close_requires_admin() fail {
  let tx = Transaction {
    ..update_tx(feed_output(good_next()), operator),
    outputs: [],
    mint: assets.from_asset(policy, auth_token_name, -1),
  }
  oracle.spend(
    settings,
    Some(feed(0, t0, base_prices, 100_000_000)),
    Close,
    own_ref,
    tx,
  )
}
