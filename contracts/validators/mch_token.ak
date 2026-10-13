//// The MCH token: fixed supply, CIP-68 metadata.
////
//// `MintSupply` can succeed exactly once, because it must consume the seed
//// UTxO, and it mints the entire supply plus one reference NFT in that single
//// transaction. After that, nobody (including the admin) can mint more.
//// Holders may burn their own tokens. The reference NFT stays at this script
//// so the admin can correct the metadata (name, logo, ...) later.

use aiken/collection/dict
use aiken/collection/list
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{Output, OutputReference, Transaction}
use mch/cip68
use mch/types.{
  Burn, MintSupply, Reclaim, TokenMint, TokenSettings, TokenSpend,
  UpdateMetadata,
}

validator mch_token(settings: TokenSettings) {
  mint(redeemer: TokenMint, policy_id: PolicyId, self: Transaction) {
    let reference = cip68.reference_name(settings.name)
    let fungible = cip68.fungible_name(settings.name)
    let minted = dict.to_pairs(assets.tokens(self.mint, policy_id))
    when redeemer is {
      MintSupply -> {
        expect [metadata_output] = outputs_holding(
          self.outputs,
          policy_id,
          reference,
        )
        and {
          list.has(self.extra_signatories, settings.admin),
          list.any(self.inputs, fn(i) { i.output_reference == settings.seed }),
          settings.supply > 0,
          // Asset names sort as bytes, and label 100 (000643b0) < 333 (0014df10).
          minted == [Pair(reference, 1), Pair(fungible, settings.supply)],
          metadata_output.address.payment_credential == Script(policy_id),
          holds_only_ada_and(metadata_output, policy_id, reference),
          cip68.is_valid_datum(metadata_output.datum),
        }
      }
      Burn ->
        // Only burning, only the fungible token. The reference NFT is permanent.
        list.all(
          minted,
          fn(Pair(name, quantity)) { name == fungible && quantity < 0 },
        )
    }
  }

  spend(
    _datum: Option<Data>,
    redeemer: TokenSpend,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(own_input) = transaction.find_input(self.inputs, own_ref)
    let own_credential = own_input.output.address.payment_credential
    expect Script(policy_id) = own_credential
    let reference = cip68.reference_name(settings.name)
    let holds_reference = assets.quantity_of(
      own_input.output.value,
      policy_id,
      reference,
    ) == 1
    and {
      list.has(self.extra_signatories, settings.admin),
      when redeemer is {
        UpdateMetadata -> {
          expect [metadata_output] = outputs_holding(
            self.outputs,
            policy_id,
            reference,
          )
          and {
            holds_reference,
            metadata_output.address.payment_credential == own_credential,
            holds_only_ada_and(metadata_output, policy_id, reference),
            cip68.is_valid_datum(metadata_output.datum),
          }
        }
        // Lets the admin recover anything sent here by mistake, but never the
        // reference NFT.
        Reclaim -> !holds_reference
      },
    }
  }

  else(_) {
    fail
  }
}

fn outputs_holding(
  outputs: List<Output>,
  policy_id: PolicyId,
  name: ByteArray,
) -> List<Output> {
  list.filter(
    outputs,
    fn(o) { assets.quantity_of(o.value, policy_id, name) > 0 },
  )
}

fn holds_only_ada_and(
  output: Output,
  policy_id: PolicyId,
  name: ByteArray,
) -> Bool {
  assets.flatten(assets.without_lovelace(output.value)) == [
    (policy_id, name, 1),
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const admin = #"aa000000000000000000000000000000000000000000000000000001"

const stranger = #"cc000000000000000000000000000000000000000000000000000003"

const policy = #"ee000000000000000000000000000000000000000000000000000005"

const seed =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000009",
    output_index: 1,
  }

const supply = 100_000_000_000_000

const settings = TokenSettings { admin, seed, name: "MCH", supply }

fn metadata_datum(version: Int) -> transaction.Datum {
  let metadata: Pairs<ByteArray, Data> = [
    Pair("name", as_data("MCH")),
    Pair("ticker", as_data("MCH")),
    Pair("decimals", as_data(6)),
  ]
  transaction.InlineDatum(
    as_data(cip68.Cip68Datum { metadata, version, extra: as_data(Void) }),
  )
}

fn as_data(x: Data) -> Data {
  x
}

fn metadata_output(datum: transaction.Datum) -> Output {
  Output {
    address: address.from_script(policy),
    value: assets.from_lovelace(2_000_000)
      |> assets.add(policy, cip68.reference_name("MCH"), 1),
    datum,
    reference_script: None,
  }
}

fn treasury_output() -> Output {
  Output {
    address: address.from_verification_key(admin),
    value: assets.from_lovelace(2_000_000)
      |> assets.add(policy, cip68.fungible_name("MCH"), supply),
    datum: transaction.NoDatum,
    reference_script: None,
  }
}

fn seed_input() -> transaction.Input {
  transaction.Input {
    output_reference: seed,
    output: Output {
      address: address.from_verification_key(admin),
      value: assets.from_lovelace(50_000_000),
      datum: transaction.NoDatum,
      reference_script: None,
    },
  }
}

fn mint_tx(minted: assets.Assets) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [seed_input()],
    outputs: [metadata_output(metadata_datum(1)), treasury_output()],
    mint: minted,
    extra_signatories: [admin],
  }
}

fn full_mint() -> assets.Assets {
  assets.from_asset(policy, cip68.reference_name("MCH"), 1)
    |> assets.add(policy, cip68.fungible_name("MCH"), supply)
}

test mint_supply_accepted() {
  mch_token.mint(settings, MintSupply, policy, mint_tx(full_mint()))
}

test mint_requires_seed() fail {
  mch_token.mint(
    settings,
    MintSupply,
    policy,
    Transaction { ..mint_tx(full_mint()), inputs: [] },
  )
}

test mint_requires_admin() fail {
  mch_token.mint(
    settings,
    MintSupply,
    policy,
    Transaction { ..mint_tx(full_mint()), extra_signatories: [stranger] },
  )
}

test mint_rejects_more_than_supply() fail {
  let minted = assets.from_asset(policy, cip68.reference_name("MCH"), 1)
    |> assets.add(policy, cip68.fungible_name("MCH"), supply + 1)
  mch_token.mint(settings, MintSupply, policy, mint_tx(minted))
}

test mint_rejects_second_reference_nft() fail {
  let minted = assets.from_asset(policy, cip68.reference_name("MCH"), 2)
    |> assets.add(policy, cip68.fungible_name("MCH"), supply)
  mch_token.mint(settings, MintSupply, policy, mint_tx(minted))
}

test mint_rejects_extra_asset_name() fail {
  let minted = assets.add(full_mint(), policy, "SNEAKY", 1)
  mch_token.mint(settings, MintSupply, policy, mint_tx(minted))
}

test mint_rejects_reference_nft_kept_by_admin() fail {
  let tx = Transaction {
    ..mint_tx(full_mint()),
    outputs: [
      Output {
        ..metadata_output(metadata_datum(1)),
        address: address.from_verification_key(admin),
      },
      treasury_output(),
    ],
  }
  mch_token.mint(settings, MintSupply, policy, tx)
}

test mint_rejects_missing_metadata_datum() fail {
  let tx = Transaction {
    ..mint_tx(full_mint()),
    outputs: [metadata_output(transaction.NoDatum), treasury_output()],
  }
  mch_token.mint(settings, MintSupply, policy, tx)
}

test mint_rejects_metadata_version_zero() fail {
  let tx = Transaction {
    ..mint_tx(full_mint()),
    outputs: [metadata_output(metadata_datum(0)), treasury_output()],
  }
  mch_token.mint(settings, MintSupply, policy, tx)
}

test anyone_can_burn_their_tokens() {
  let tx = Transaction {
    ..transaction.placeholder,
    mint: assets.from_asset(policy, cip68.fungible_name("MCH"), -500),
  }
  mch_token.mint(settings, Burn, policy, tx)
}

test burn_cannot_mint() fail {
  let tx = Transaction {
    ..transaction.placeholder,
    mint: assets.from_asset(policy, cip68.fungible_name("MCH"), 500),
  }
  mch_token.mint(settings, Burn, policy, tx)
}

test burn_cannot_destroy_reference_nft() fail {
  let tx = Transaction {
    ..transaction.placeholder,
    mint: assets.from_asset(policy, cip68.reference_name("MCH"), -1),
  }
  mch_token.mint(settings, Burn, policy, tx)
}

const metadata_ref =
  OutputReference {
    transaction_id: #"000000000000000000000000000000000000000000000000000000000000000a",
    output_index: 0,
  }

fn update_metadata_tx(next: Output, signer: ByteArray) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      transaction.Input {
        output_reference: metadata_ref,
        output: metadata_output(metadata_datum(1)),
      },
    ],
    outputs: [next],
    extra_signatories: [signer],
  }
}

test update_metadata_by_admin() {
  mch_token.spend(
    settings,
    None,
    UpdateMetadata,
    metadata_ref,
    update_metadata_tx(metadata_output(metadata_datum(2)), admin),
  )
}

test update_metadata_requires_admin() fail {
  mch_token.spend(
    settings,
    None,
    UpdateMetadata,
    metadata_ref,
    update_metadata_tx(metadata_output(metadata_datum(2)), stranger),
  )
}

test update_metadata_cannot_move_reference_nft() fail {
  let moved = Output {
    ..metadata_output(metadata_datum(2)),
    address: address.from_verification_key(admin),
  }
  mch_token.spend(
    settings,
    None,
    UpdateMetadata,
    metadata_ref,
    update_metadata_tx(moved, admin),
  )
}

test reclaim_cannot_take_reference_nft() fail {
  mch_token.spend(
    settings,
    None,
    Reclaim,
    metadata_ref,
    update_metadata_tx(treasury_output(), admin),
  )
}

test reclaim_recovers_stray_ada() {
  let stray = Output {
    address: address.from_script(policy),
    value: assets.from_lovelace(3_000_000),
    datum: transaction.NoDatum,
    reference_script: None,
  }
  let tx = Transaction {
    ..transaction.placeholder,
    inputs: [
      transaction.Input { output_reference: metadata_ref, output: stray },
    ],
    extra_signatories: [admin],
  }
  mch_token.spend(settings, None, Reclaim, metadata_ref, tx)
}
