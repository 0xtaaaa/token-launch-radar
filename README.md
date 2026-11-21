# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks all 198 pre-token protocols in the snapshot by a fitted implied token value, and shows a concrete farm plan for each one — each plan ending in a verdict that nets its gas and fees against the expected value at the low end of the value band. Protocols whose token already trades are set aside with their market caps, never ranked as launch candidates. Every one of the snapshot's 758 protocols is accounted for: ranked, live, or excluded with a reason.

## The model — radar-4, a clean-comps size curve

The implied value is a ridge regression fitted at run time from the snapshot's own tokened protocols — but only the clean comps. The training set is built in two steps: first, exchange, bridge and staking products and versioned, wrapped or exchange-named protocols are removed (52 of the 144 protocols with a market cap are that kind of product, or record a zero cap); then the market-cap-to-TVL ratio is trimmed to its 5th–95th percentile band (0.01 to 3.62), which removes 9 more protocols whose tokens trade at a ratio no peer supports. What remains is 83 clean comps. The regression is log10(market cap) on log10(TVL), the category group and log10(chain count):

```
log10(implied value) = 3.3618 + 0.4823 x log10(tvl_usd)
    + group adjustment (Dexs = 0, LEND -0.3021,
      RWA +0.0521, YIELD -0.0931)
    - 0.1369 x log10(chain count)
```

Ridge lambda 10, intercept unpenalised, computed from the snapshot by `main.ts` — no name and no value is ever hardcoded. The same function scores every row.

## How the terms were chosen — and how good the fit is

Every term was kept only if it improved leave-one-out error. Age (from `listed_at`) and seven-day growth were tested and dropped: neither improved it. Per-category slopes were tested and rejected as unstable (a held-out fold R-squared of -2.5). The chain-count term stays because it improves leave-one-out error (x2.70 without it, x2.63 with it). Trimming the ratio outliers matters too: the same fit on the untrimmed 92 comps has a leave-one-out error of x2.94.

| Check | Result |
|---|---|
| Full fit, all 83 clean comps | R-squared 0.35, median error x2.53 |
| Leave-one-out, refit without each comp | Median error x2.63 |
| Held out, every 5th protocol (test i%5 in {0,1}, n=34) | R-squared 0.31, median error x3.19 |
| Held out, every 5th protocol (test i%5 in {2,3}, n=33) | R-squared 0.23, median error x2.43 |

The fit is honestly weak, and the board says so: size, category and chain count explain about a third of what a token ends up worth. The rest is the team, the timing and the narrative — none of which a TVL snapshot can see. The ranking is a prior, not a price.

Launch odds are the snapshot's own one-year hazard by age — the share of protocols that gain a token moving from one age bucket to the next (0–6 months 18%, 6–12 months 5%, 1–2 years 27%, 2–3 years 54%, 3+ years 26%), floored at 5% and capped at 60%. Expected value is the implied value times those odds. The farm verdict nets the plan's gas and fees against the expected value at the low end of the value band (implied value divided by the leave-one-out error of x2.63), so a plan that only pays at the top of the band says so.

## The board

- 198 rows: the whole rankable set — all 40 watchlist protocols (watchlist TVL $12.93B) plus every other rankable pre-token protocol in the snapshot.
- Rank 1 is Sentora Curator at $68.0M implied ($18.1M expected value, $6.9M at the low end); the median row is $7.2M implied; the last row is $2.2M.
- Each row carries a seven-step farm plan naming a concrete deposit ($50–$250 by TVL), gas by chain and a hold period in days, ending in a costed verdict.
- Coverage: 758 protocols accounted for — 198 ranked, 24 live (shown at market cap), 536 excluded with a reason (392 token already trades, 128 CEX/bridge/staking products, 16 wrapped, staked or versioned products).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3k5038j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · referral: https://make.fun/r/s3k5038j · AI agents build software for cash rewards</sub>
