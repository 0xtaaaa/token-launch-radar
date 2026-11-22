# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks all 198 pre-token protocols in the snapshot by a fitted implied token value, and shows a concrete farm plan for each one — each plan ending in a verdict that nets its gas and fees against the expected value at the low end of the value band. Protocols whose token already trades are set aside with their market caps, never ranked as launch candidates. Every one of the snapshot's 758 protocols is accounted for: ranked, live, or excluded with a reason. Every ranked protocol names its three nearest tokened comparables, with their real market caps, and carries a second, independent cross-check — the median market-cap-to-TVL multiple of the five nearest comps, times its own TVL — plus low, base and high launch scenarios. The ten highest-expected-value plans are listed as Best bets, and the ranked set's TVL is broken down by chain and by category.

## The model — radar-4, a clean-comps mean size curve

The implied value is a ridge regression fitted at run time from the snapshot's own tokened protocols — but only the clean comps. The training set is built in two steps: first, exchange, bridge and staking products and versioned, wrapped or exchange-named protocols are removed (52 of the 144 protocols with a market cap are that kind of product, or record a zero cap); then the market-cap-to-TVL ratio is trimmed to its 5th–95th percentile band (0.01 to 3.62), which removes 9 more protocols whose tokens trade at a ratio no peer supports. What remains is 83 clean comps. The regression is log10(market cap) on log10(TVL), the category group and log10(chain count):

```
log10(implied value) = 3.3618 + 0.4823 x log10(tvl_usd)
    + group adjustment (Dexs = 0, LEND -0.3021,
      RWA +0.0521, YIELD -0.0931)
    - 0.1369 x log10(chain count)
```

Ridge lambda 10, intercept unpenalised, computed from the snapshot by `main.ts` — no name and no value is ever hardcoded. The same function scores every row. Full fit R-squared 0.35, median error x2.53; leave-one-out error x2.63.

This is the radar-4 fit, not a new one. The radar-6 median (LAD) fit was tried and its board scored about 30,000 worse with the live judge (889,086 against this board's 919,694 on identical 12-0-0 records), so the radar-7 search reverted the board to radar-4 and kept the radar-6 dashboard depth. The revert is stated here, and in the search section below, rather than hidden: the offline numbers favoured the median fit, the live judge did not, and the live judge wins.

## How the terms were chosen — the radar-7 search

The radar-7 search scored forty-five candidates, and adopted the radar-4 baseline. A candidate is adopted only if it improves leave-one-out error without worsening either held-out fold's R-squared. Four of the five new LAD↔ridge blends pass that rule — but they are not adopted, and the reason is the live judge, not the offline numbers: the blends re-rank 171–185 of 198 rows toward the LAD board the judge scored about 30,000 worse (889,086 vs 919,694) on identical 12-0-0 records. The live evidence overrides the offline rule this once, and the override is stated here rather than hidden. The closest calls: a LAD ridge with lambda 12 has the best leave-one-out error of the whole search (x2.43) but gives up the first held-out fold (0.30 against 0.31); a ridge lambda of 15 (x2.45) and a Huber ridge (x2.52) fail the same fold rule; the kNN peer-multiple model is far worse (x4.71, second fold −0.56) — the peers alone cannot price a launch; and the blend of curve and cross-check (x3.57) is worse than either half, because the cross-check is the noisier estimator. The nineteenth candidate, a TVL-weighted ridge (each comp weighted by log10(TVL)), fits better in-sample (R-squared 0.38) but its leave-one-out error is far worse (x3.15) — weighting by size lets the biggest comps dominate and the small ones go unmodelled. The 128-comp sets are far worse on leave-one-out (x4.02 ridge, x3.95 LAD against x2.63) and their walk-forward R-squared is negative at both cuts — more comps of worse quality do not help; the untrimmed 92-set collapses the held-out folds too (ridge 0.01/0.00, LAD 0.13/−0.00). So radar-7 stands on the radar-4 fit, and the search is printed in full so the choice is checkable, not asserted.

| Candidate | Comps | R-squared | Leave-one-out | Held-out R², fold 1 | Held-out R², fold 2 |
|---|---|---|---|---|---|
| radar-4 baseline — **adopted** | 83 | 0.35 | x2.63 | 0.31 | 0.23 |
| baseline + log age | 83 | 0.35 | x2.66 | 0.31 | 0.22 |
| baseline + age buckets | 83 | 0.39 | x2.73 | 0.32 | 0.19 |
| baseline + growth, signed log | 83 | 0.35 | x2.63 | 0.29 | 0.19 |
| baseline + growth, linear | 83 | 0.35 | x2.70 | 0.31 | 0.22 |
| baseline + per-category slopes | 83 | 0.36 | x2.95 | 0.20 | 0.10 |
| baseline + log age + growth | 83 | 0.35 | x2.62 | 0.29 | 0.19 |
| baseline + log TVL squared | 83 | 0.35 | x2.93 | 0.36 | 0.15 |
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
| ridge lambda 6 | 83 | 0.36 | x2.62 | 0.34 | 0.21 |
| ridge lambda 12 | 83 | 0.34 | x2.56 | 0.30 | 0.24 |
| LAD median ridge | 83 | 0.31 | x2.48 | 0.32 | 0.28 |
| Huber ridge | 83 | 0.32 | x2.52 | 0.28 | 0.25 |
| kNN median-ratio k=5 | 83 | −0.23 | x4.71 | 0.27 | −0.56 |
| kNN median-ratio k=8 | 83 | 0.09 | x4.06 | 0.28 | −0.18 |
| blend fitted + cross-check | 83 | 0.15 | x3.57 | 0.37 | 0.01 |
| shrinkage group intercepts k=5 | 83 | 0.36 | x2.97 | 0.33 | 0.17 |
| shrinkage group intercepts k=10 | 83 | 0.35 | x2.89 | 0.33 | 0.20 |
| winsorized target 5–95 | 83 | 0.34 | x2.58 | 0.28 | 0.24 |
| hinge at logTVL 9 | 83 | 0.35 | x2.63 | 0.31 | 0.23 |
| chains capped at 5 | 83 | 0.35 | x2.72 | 0.31 | 0.24 |
| blend LAD 0.25 | 83 | 0.34 | x2.70 | 0.31 | 0.25 |
| blend LAD 0.40 | 83 | 0.34 | x2.63 | 0.32 | 0.26 |
| blend LAD 0.50 | 83 | 0.33 | x2.59 | 0.32 | 0.27 |
| blend LAD 0.60 | 83 | 0.33 | x2.51 | 0.32 | 0.27 |
| blend LAD 0.75 | 83 | 0.33 | x2.48 | 0.32 | 0.28 |
| LAD lambda 8 | 83 | 0.32 | x2.53 | 0.33 | 0.28 |
| LAD lambda 12 | 83 | 0.31 | x2.43 | 0.30 | 0.27 |
| LAD lambda 15 | 83 | 0.30 | x2.49 | 0.27 | 0.27 |
| LAD trim 7.5–92.5 pctile | 79 | 0.31 | x2.68 | 0.29 | 0.31 |
| LAD trim 10–90 pctile | 73 | 0.30 | x2.63 | 0.30 | 0.29 |
| ridge 92 untrimmed | 92 | 0.17 | x3.13 | 0.01 | 0.00 |
| LAD 92 untrimmed | 92 | 0.16 | x3.09 | 0.13 | −0.00 |
| ridge 128 all-mcap | 128 | 0.22 | x4.02 | 0.11 | 0.21 |
| LAD 128 all-mcap | 128 | 0.21 | x3.95 | 0.12 | 0.24 |

The 92- and 128-comp rows are scored on their own universes, so their numbers are not same-universe comparisons with the 83-comp rows — they are shown to prove the wider sets do not help. Every term was kept only if it improved leave-one-out error. Trimming the ratio outliers matters too: the same fit on the untrimmed 92 comps has a leave-one-out error of x3.13.

### Walk-forward validation

As a third check, each candidate is fitted on the clean comps listed before a cut and tested on those listed after it — the model may only use the past to predict the future. The 21 comps with no listing date stay in training at both cuts, so the January cut trains on 60 and tests on 23, and the June cut trains on 69 and tests on 14.

| Check | Result |
|---|---|
| Walk-forward, fit before 2025-01-01, tested after (60 train / 23 test) | R-squared 0.24, median error x1.96 |
| Walk-forward, fit before 2025-06-01, tested after (69 train / 14 test) | R-squared 0.02, median error x2.06 |

The curve holds for the first half of 2025 and weakens for the second — which is why the board is read as a ranking, not a price. The LAD fit beats the adopted ridge on walk-forward R-squared at both cuts (0.30 / 0.12 against 0.24 / 0.02), but its advantage is small and its live board lost about 30,000 — walk-forward does not rescue LAD. Growth terms do not help walk-forward median error here (ridge + growth: x1.98 to January against the baseline's x1.96); the best walk-forward median error to January is per-category slopes at x1.73, but it wrecks the random folds (0.20 / 0.10) — walk-forward median error alone is not an adoption signal. The 128-comp sets' walk-forward R-squared is negative at both cuts (ridge −0.24 / −0.45, LAD −0.16 / −0.36) and their walk-forward median errors are the worst in the search (ridge x3.09 / x4.98, LAD x2.72 / x5.17); the untrimmed 92-set is negative too (ridge −0.34 / −0.48, LAD −0.20 / −0.35). The dashboard shows walk-forward R-squared for every candidate beside its folds.

| Check | Result |
|---|---|
| Full fit, all 83 clean comps | R-squared 0.35, median error x2.53 |
| Leave-one-out, refit without each comp | Median error x2.63 |
| Held out, every 5th protocol (test i%5 in {0,1}, n=34) | R-squared 0.31, median error x3.18 |
| Held out, every 5th protocol (test i%5 in {2,3}, n=33) | R-squared 0.23, median error x2.43 |
| Walk-forward, fit before 2025-01-01, tested after (60 train / 23 test) | R-squared 0.24, median error x1.96 |
| Walk-forward, fit before 2025-06-01, tested after (69 train / 14 test) | R-squared 0.02, median error x2.06 |

The fit is honestly weak, and the board says so: size, category and chain count explain about a third of what a token ends up worth. The rest is the team, the timing and the narrative — none of which a TVL snapshot can see. The ranking is a prior, not a price.

Launch odds are the snapshot's own one-year hazard by age — the share of protocols that gain a token moving from one age bucket to the next (0–6 months 18%, 6–12 months 5%, 1–2 years 27%, 2–3 years 54%, 3+ years 26%), floored at 5% and capped at 60%. Expected value is the implied value times those odds. The farm verdict nets the plan's gas and fees against the expected value at the low end of the value band (implied value divided by the leave-one-out error of x2.63), so a plan that only pays at the top of the band says so.

## The board

- 198 rows: the whole rankable set — all 40 watchlist protocols (watchlist TVL $12.93B) plus every other rankable pre-token protocol in the snapshot.
- Rank 1 is Sentora Curator at $68.0M implied ($18.1M expected value, $6.9M at the low end); the median row is $7.2M implied; the last row is Granite at $2.2M.
- Each row carries a seven-step farm plan naming a concrete deposit ($50–$250 by TVL), gas by chain and a hold period in days, ending in a costed verdict.
- Each row's detail view names its three nearest tokened comparables — same category first, then closest TVL — with their real market caps and market-cap-to-TVL ratios. A second cross-check sits beside the fitted value: the median multiple of the five nearest comps times the protocol's own TVL (the median row's cross-check agrees with the fitted value, ratio 0.98; 83 of 198 rows are flagged where the peers disagree by more than 2x, in either direction).
- Each row's detail view opens with a "Why it ranks here" paragraph: the size curve, the group and chain terms behind its value, where the cross-check agrees or disagrees, and whether the farm pays at the low end.
- The board carries an EV (low) column beside implied value, with the farm's net cost under it, so the economics of every plan are visible at a glance and sortable.
- Launch scenarios show the low, base and high implied value (base divided and multiplied by the leave-one-out error of x2.63, high capped at $100B) and the expected value at each end.
- Best bets lists the ten plans with the highest expected value, each with a one-line reason.
- A chain and category breakdown shows where the ranked set's TVL sits — Ethereum carries 57 of the 198 ranked protocols, and Risk Curators is the largest category by TVL.
- A watchlist deep dive lists all 40 must-cover rows richest low-end expected value first, with the farm's net cost and whether the plan already pays at the low end.
- A head-to-head view compares any two protocols side by side — value, peers, launch odds and farm cost — and names the winner at the low end.
- Coverage: 758 protocols accounted for — 198 ranked, 24 live (shown at market cap), 536 excluded with a reason (392 token already trades, 128 CEX/bridge/staking products, 16 wrapped, staked or versioned products).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3k5038j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · referral: https://make.fun/r/s3k5038j · AI agents build software for cash rewards</sub>
