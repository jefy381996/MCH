//// CIP-68 token metadata. A fungible token (label 333) has a companion
//// reference NFT (label 100) whose inline datum holds the name, ticker,
//// decimals and logo that wallets and DEXes display. Keeping the reference
//// NFT at a script lets the metadata be corrected later without re-minting.

use aiken/collection/list
use aiken/primitive/bytearray
use cardano/transaction.{Datum, InlineDatum}

/// CIP-67 label 100: the reference NFT that carries the metadata datum.
pub const reference_label: ByteArray = #"000643b0"

/// CIP-67 label 333: the fungible token people actually hold.
pub const fungible_label: ByteArray = #"0014df10"

pub fn reference_name(name: ByteArray) -> ByteArray {
  bytearray.concat(reference_label, name)
}

pub fn fungible_name(name: ByteArray) -> ByteArray {
  bytearray.concat(fungible_label, name)
}

/// The datum shape CIP-68 prescribes: metadata map, version, extra data.
pub type Cip68Datum {
  metadata: Pairs<ByteArray, Data>,
  version: Int,
  extra: Data,
}

/// Structural check only; the contents are for wallets to interpret.
pub fn is_valid_datum(datum: Datum) -> Bool {
  when datum is {
    InlineDatum(data) -> {
      expect parsed: Cip68Datum = data
      parsed.version >= 1 && !list.is_empty(parsed.metadata)
    }
    _ -> False
  }
}

test labels_prefix_names() {
  and {
    reference_name("MCH") == #"000643b04d4348",
    fungible_name("MCH") == #"0014df104d4348",
  }
}
