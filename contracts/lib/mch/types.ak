use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference}

/// One metal in the basket. Mirrors `BasketComponent` in packages/index-core.
pub type Component {
  /// Metal code as UTF-8 bytes, e.g. "XAU".
  metal: ByteArray,
  /// Share of the index in parts per million. All weights sum to 1_000_000.
  weight_ppm: Int,
  /// Base-date price in micro-USD per the metal's unit.
  base_price: Int,
}

/// Fixed for the lifetime of an oracle deployment. Changing anything here
/// gives a different script hash, which is a new, separately announced feed.
/// That is deliberate: nobody can quietly re-weight the basket.
pub type OracleSettings {
  /// Cold key. Creates and closes the feed and rotates the operator key.
  admin: VerificationKeyHash,
  /// UTxO consumed when the feed is created, so the auth NFT can only ever
  /// be minted once.
  seed: OutputReference,
  basket_version: Int,
  basket: List<Component>,
  /// Widest validity range an update may use. Bounds how far `published_at`
  /// can sit from the real time at which the ledger accepted the update.
  max_validity_ms: Int,
}

/// The on-chain state of the feed, held as an inline datum next to the auth NFT.
pub type OracleDatum {
  /// MCH index in micro-points (index x 10^6). Always equal to the index
  /// recomputed from `prices`; the validator enforces it.
  index: Int,
  /// Micro-USD price of each basket metal, in basket order.
  prices: List<Int>,
  /// POSIX milliseconds at which the operator attests these prices are current.
  published_at: Int,
  /// Starts at 0 and increases by exactly 1 with every price update.
  sequence: Int,
  basket_version: Int,
  /// Hot key allowed to publish price updates. The admin can rotate it.
  operator: VerificationKeyHash,
}

pub type OracleSpend {
  Update
  RotateOperator { new_operator: VerificationKeyHash }
  Close
}

pub type OracleMint {
  Create
  Destroy
}

/// Fixed parameters of the MCH token.
pub type TokenSettings {
  /// Key that mints the supply (once) and may update the token metadata.
  admin: VerificationKeyHash,
  /// UTxO consumed by the single mint, so the supply can never be increased.
  seed: OutputReference,
  /// Asset name without its CIP-67 label, e.g. "MCH".
  name: ByteArray,
  /// Entire supply in base units. Decimals are a display convention.
  supply: Int,
}

pub type TokenMint {
  MintSupply
  Burn
}

pub type TokenSpend {
  UpdateMetadata
  Reclaim
}
