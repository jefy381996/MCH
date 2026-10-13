//// A permanent home for reference scripts. Nothing can ever be spent from
//// this address, so a script published here stays readable, at a fixed
//// location, for as long as the chain exists. Transactions then reference the
//// script instead of carrying its bytes, which keeps oracle updates cheap.

validator script_store {
  else(_) {
    fail
  }
}
