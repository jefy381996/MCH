#!/usr/bin/env python3
# Regenerate with: python3 packages/index-core/test/gen-vectors.py > packages/index-core/test/vectors.json
# Independent reference for the MCH index spec, used only to produce expected
# values for test vectors. Implements: floor each term at 1e-12, sum, round half up.
import json
from fractions import Fraction

P = 10**12
def spec(components, prices):
    total = 0
    for (metal, w, b) in components:
        total += (100 * w * prices[metal] * P) // b
    return (total + P // 2) // P

def exact(components, prices):
    s = sum(Fraction(100 * w * prices[m], b) for (m, w, b) in components)
    # round half up
    return (s + Fraction(1, 2)).__floor__()

def micro(s):
    whole, _, frac = s.partition('.')
    return int(whole) * 10**6 + int(frac.ljust(6, '0'))

EQ = [("XAU", 250000, micro("4000")), ("XAG", 250000, micro("48")),
      ("XPT", 250000, micro("1600")), ("NI", 250000, micro("15500"))]

cases = []
def add(name, comps, prices_txt):
    prices = {k: micro(v) for k, v in prices_txt.items()}
    e = spec(comps, prices)
    x = exact(comps, prices)
    assert e == x, (name, e, x)
    cases.append({
        "name": name,
        "components": [{"metal": m, "weightPpm": w, "basePriceMicro": str(b)} for (m, w, b) in comps],
        "pricesMicro": {k: str(v) for k, v in prices.items()},
        "expectedIndexMicro": str(e),
    })

add("all prices at base -> exactly 100", EQ, {"XAU": "4000", "XAG": "48", "XPT": "1600", "NI": "15500"})
add("roadmap worked example: +10%, -5%, +2%, flat -> 101.75", EQ,
    {"XAU": "4400", "XAG": "45.6", "XPT": "1632", "NI": "15500"})
add("every metal doubles -> 200", EQ, {"XAU": "8000", "XAG": "96", "XPT": "3200", "NI": "31000"})
add("nickel x3.5 (March 2022 style squeeze), rest flat", EQ,
    {"XAU": "4000", "XAG": "48", "XPT": "1600", "NI": "54250"})
add("odd prices exercising rounding", EQ,
    {"XAU": "4012.345678", "XAG": "47.123457", "XPT": "1599.999999", "NI": "15512.25"})
add("one micro-dollar move in silver", EQ, {"XAU": "4000", "XAG": "48.000001", "XPT": "1600", "NI": "15500"})
add("crash: everything down 90%", EQ, {"XAU": "400", "XAG": "4.8", "XPT": "160", "NI": "1550"})
UNEQ = [("XAU", 400000, micro("4000")), ("XAG", 100000, micro("48")),
        ("XPT", 200000, micro("1600")), ("NI", 300000, micro("15500"))]
add("unequal weights 40/10/20/30", UNEQ, {"XAU": "4100", "XAG": "50", "XPT": "1550", "NI": "16000"})
THIRDS = [("XAU", 333333, micro("3")), ("XAG", 333333, micro("7")), ("NI", 333334, micro("11"))]
add("thirds with awkward base prices", THIRDS, {"XAU": "4", "XAG": "5", "NI": "13"})
add("single-metal basket", [("XAU", 1000000, micro("4000"))], {"XAU": "4321.98"})

# Pin half-up rounding: 100 * 1e6 * 200000001 / 2e8 = 100000000.5 exactly -> 100000001.
add_half_comps = [("XAU", 1000000, micro("200"))]
add_half_prices = {"XAU": micro("200.000001")}
_t = sum(Fraction(100 * w * add_half_prices[m], b) for (m, w, b) in add_half_comps)
assert _t == Fraction(200000001, 2), _t
add("exact half micro-point rounds up", add_half_comps, {"XAU": "200.000001"})
# And just below half must round down: 100 * 1e6 * 600000001 / 6e8 = 100000000.1666.. -> 100000000
add("just below half rounds down", [("XAU", 1000000, micro("600"))], {"XAU": "600.000001"})

print(json.dumps({"description": "Shared MCH index test vectors. Consumed by packages/index-core tests and generated into contracts/lib/mch/index_vectors_test.ak. Expected values come from an independent exact-rational reference.", "cases": cases}, indent=2))
for c in cases: print(c["name"], c["expectedIndexMicro"], file=__import__('sys').stderr)
