//// The MCH index, bit-for-bit identical to packages/index-core/src/index-math.ts:
////
////   index = 100 x SUM_i( weight_i x price_i / base_price_i )
////
//// Each term is floored at 10^-12 micro-points, the terms are summed, and the
//// total is rounded half-up to whole micro-points. The shared vectors in
//// index_vectors.test.ak are generated from the TypeScript test suite, so the
//// two implementations cannot drift apart unnoticed.

use aiken/collection/list
use mch/types.{Component}

/// Extra precision carried through the sum before the single final rounding.
pub const precision: Int = 1_000_000_000_000

/// Basket weights must add up to exactly this.
pub const total_weight_ppm: Int = 1_000_000

/// Index value on the base date: 100.000000.
pub const base_index: Int = 100_000_000

/// Index in micro-points. Fails if there is not exactly one positive price per
/// basket metal, so a malformed update can never be accepted.
pub fn compute_index(basket: List<Component>, prices: List<Int>) -> Int {
  ( sum_terms(basket, prices, 0) + precision / 2 ) / precision
}

fn sum_terms(basket: List<Component>, prices: List<Int>, acc: Int) -> Int {
  when basket is {
    [] -> {
      expect [] = prices
      acc
    }
    [c, ..rest] -> {
      expect [p, ..more] = prices
      expect p > 0
      sum_terms(
        rest,
        more,
        acc + 100 * c.weight_ppm * p * precision / c.base_price,
      )
    }
  }
}

/// Mirrors `validateBasket` in packages/index-core.
pub fn is_valid_basket(basket: List<Component>) -> Bool {
  let n = list.length(basket)
  and {
    n > 0,
    n <= 8,
    list.all(basket, fn(c) { c.weight_ppm > 0 && c.base_price > 0 }),
    list.foldl(basket, 0, fn(c, acc) { acc + c.weight_ppm }) == total_weight_ppm,
    list.unique(list.map(basket, fn(c) { c.metal })) == list.map(
      basket,
      fn(c) { c.metal },
    ),
  }
}

// ---------------------------------------------------------------------------

const equal_basket: List<Component> =
  [
    Component { metal: "XAU", weight_ppm: 250_000, base_price: 4_000_000_000 },
    Component { metal: "XAG", weight_ppm: 250_000, base_price: 48_000_000 },
    Component { metal: "XPT", weight_ppm: 250_000, base_price: 1_600_000_000 },
    Component { metal: "NI", weight_ppm: 250_000, base_price: 15_500_000_000 },
  ]

test index_is_100_at_base_prices() {
  compute_index(
    equal_basket,
    [4_000_000_000, 48_000_000, 1_600_000_000, 15_500_000_000],
  ) == base_index
}

test rejects_missing_price() fail {
  compute_index(equal_basket, [4_000_000_000, 48_000_000, 1_600_000_000]) > 0
}

test rejects_extra_price() fail {
  compute_index(
    equal_basket,
    [4_000_000_000, 48_000_000, 1_600_000_000, 15_500_000_000, 1],
  ) > 0
}

test rejects_zero_price() fail {
  compute_index(equal_basket, [4_000_000_000, 0, 1_600_000_000, 15_500_000_000]) > 0
}

test rejects_negative_price() fail {
  compute_index(
    equal_basket,
    [4_000_000_000, -48_000_000, 1_600_000_000, 15_500_000_000],
  ) > 0
}

test valid_basket_accepted() {
  is_valid_basket(equal_basket)
}

test basket_weights_must_sum_to_one_million() {
  !is_valid_basket(
    [
      Component { metal: "XAU", weight_ppm: 500_000, base_price: 1 },
      Component { metal: "XAG", weight_ppm: 499_999, base_price: 1 },
    ],
  )
}

test basket_metals_must_be_unique() {
  !is_valid_basket(
    [
      Component { metal: "XAU", weight_ppm: 500_000, base_price: 1 },
      Component { metal: "XAU", weight_ppm: 500_000, base_price: 1 },
    ],
  )
}

test empty_basket_rejected() {
  !is_valid_basket([])
}

test basket_rejects_zero_base_price() {
  !is_valid_basket(
    [Component { metal: "XAU", weight_ppm: 1_000_000, base_price: 0 }],
  )
}
