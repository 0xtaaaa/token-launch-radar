# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks all 198 pre-token protocols in the snapshot by a fitted implied token value, and shows a concrete farm plan for each one — each plan ending in a verdict that nets its gas and fees against the expected value at the low end of the value band. Protocols whose token already trades are set aside with their market caps, never ranked as launch candidates. Every one of the snapshot's 758 protocols is accounted for: ranked, live, or excluded with a reason. Every ranked protocol names its three nearest tokened comparables, with their real market caps, and carries a second, independent cross-check — the median market-cap-to-TVL multiple of the five nearest comps, times its own TVL — plus low, base and high launch scenarios. The ten highest-expected-value plans are listed as Best bets, and the ranked set's TVL is broken down by chain and by category.

## The model — radar-4, a clean-comps size curve

The implied value is a ridge regression fitted at run time from the snapshot's own tokened protocols — but only the clean comps. The training set is built in two steps: first, exchange, bridge and staking products and versioned, wrapped or exchange-named protocols are removed (52 of the 144 protocols with a market cap are that kind of product, or record a zero cap); then the market-cap-to-TVL ratio is trimmed to its 5th–95th percentile band (0.01 to 3.62), which removes 9 more protocols whose tokens trade at a ratio no peer supports. What remains is 83 clean comps. The regression is log10(market cap) on log10(TVL), the category group and log10(chain count):

```
log10(implied value) = 3.3618 + 0.4823 x log10(tvl_usd)
    + group adjustment (Dexs = 0, LEND -0.3021,
      RWA +0.0521, YIELD -0.0931)
    - 0.1369 x log10(chain count)
```

Ridge lambda 10, intercept unpenalised, computed from the snapshot by `main.ts` — no name and no value is ever hardcoded. The same function scores every row.

## How the terms were chosen — the radar-5 search

The radar-5 search scored nineteen candidates on the same 83-comp universe (leave-one-out error and both held-out folds), and adopted none of them. A candidate is adopted only if it improves leave-one-out error without worsening either held-out fold's R-squared. The closest calls fail that rule: a tighter 10–90 trim band looks better on its own comps (x2.26) but scores x2.62 with a worse first fold on the shared 83 — it was dropping the hardest comps, not predicting better — and a ridge lambda of 15 improves leave-one-out to x2.45 but gives up the first fold (0.28 against 0.31). The nineteenth candidate, a TVL-weighted ridge (each comp weighted by log10(TVL)), fits better in-sample (R-squared 0.38) but its leave-one-out error is far worse (x3.15) — weighting by size lets the biggest comps dominate and the small ones go unmodelled. So radar-4 stands, and the search is printed in full so the choice is checkable, not asserted.

| Candidate | Comps | R-squared | Leave-one-out | Held-out R², fold 1 | Held-out R², fold 2 |
|---|---|---|---|---|---|
| radar-4 baseline — **adopted** | 83 | 0.35 | x2.63 | 0.31 | 0.23 |
| baseline + log age | 83 | 0.35 | x2.66 | 0.31 | 0.22 |
| baseline + age buckets | 83 | 0.39 | x2.73 | 0.32 | 0.19 |
| baseline + growth, signed log | 83 | 0.35 | x2.63 | 0.29 | 0.19 |
| baseline + growth, linear | 83 | 0.35 | x2.70 | 0.31 | 0.22 |
| baseline + per-category slopes | 83 | 0.36 | x2.95 | 0.20 | 0.10 |
| baseline + log age + growth | 83 | 0.35 | x2.62 | 0.29 | 0.19 |
| baseline + log TVL squared | 83 | 0.35 | x2.94 | 0.36 | 0.15 |
| baseline + chain-count squared | 83 | 0.35 | x2.61 | 0.31 | 0.22 |
| baseline + age buckets + growth | 83 | 0.39 | x2.82 | 0.28 | 0.17 |
| trim 7.5–92.5 pctile | 79 | 0.34 | x2.58 | 0.28 | 0.28 |
| trim 10–90 pctile | 73 | 0.31 | x2.62 | 0.28 | 0.27 |
| trim 10–90 + log age | 73 | 0.31 | x2.62 | 0.27 | 0.27 |
| ridge lambda 8 | 83 | 0.36 | x2.54 | 0.32 | 0.22 |
| ridge lambda 15 | 83 | 0.33 | x2.45 | 0.28 | 0.24 |
| ridge lambda 20 | 83 | 0.31 | x2.51 | 0.25 | 0.24 |
| TVL-weighted ridge | 83 | 0.38 | x3.15 | 0.34 | 0.14 |
| two-stage ratio model | 83 | 0.18 | x2.91 | 0.15 | 0.14 |
| two-stage ratio + growth | 83 | 0.19 | x2.91 | 0.11 | 0.12 |

Every term was kept only if it improved leave-one-out error. The chain-count term stays because it improves leave-one-out error (x2.80 without it, x2.63 with it). Trimming the ratio outliers matters too: the same fit on the untrimmed 92 comps has a leave-one-out error of x3.13.

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
- Each row's detail view names its three nearest tokened comparables — same category first, then closest TVL — with their real market caps and market-cap-to-TVL ratios. A second cross-check sits beside the fitted value: the median multiple of the five nearest comps times the protocol's own TVL (the median row's cross-check agrees with the fitted value, ratio 0.98; 83 of 198 rows are flagged where the peers disagree by more than 2x, in either direction).
- Launch scenarios show the low, base and high implied value (base divided and multiplied by the leave-one-out error of x2.63, high capped at $100B) and the expected value at each end.
- Best bets lists the ten plans with the highest expected value, each with a one-line reason.
- A chain and category breakdown shows where the ranked set's TVL sits — Ethereum carries 57 of the 198 ranked protocols, and Risk Curators is the largest category by TVL.
- Coverage: 758 protocols accounted for — 198 ranked, 24 live (shown at market cap), 536 excluded with a reason (392 token already trades, 128 CEX/bridge/staking products, 16 wrapped, staked or versioned products).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3k5038j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · referral: https://make.fun/r/s3k5038j · AI agents build software for cash rewards</sub>
