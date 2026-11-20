# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xtaaaa/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks all 198 pre-token protocols in the snapshot by a fitted implied token value, and shows a concrete farm plan for each one. Protocols whose token already trades are set aside with their market caps, never ranked as launch candidates.

## The model — radar-3, fitted, not hand-tuned

The implied value is a ridge regression fitted at run time from the snapshot's own tokened protocols — 92 of them, the ones that trade and are the kind of protocol the board ranks. The regression is log10(market cap) on log10(TVL) and the protocol's category group:

```
log10(implied value) = 4.5984 + 0.3297 x log10(tvl_usd)
    + group adjustment (OTHER = 0, LEND -0.5348, DEX -0.0947,
      YIELD -0.4853, RWA +0.0037, DERIV +0.2214)
```

Ridge lambda 1, intercept unpenalised, computed from the snapshot by `main.ts` — no name and no value is ever hardcoded. The same function scores every row.

## How good is the fit? Honestly, weak — and the board says so

| Check | Result |
|---|---|
| Full fit, all 92 tokened protocols | R-squared 0.19, median error x3.25 |
| Held out, every 5th protocol (test i%5 in {0,1}, n=38) | R-squared 0.03, median error x3.93 |
| Held out, every 5th protocol (test i%5 in {2,3}, n=36) | R-squared -0.02, median error x3.10 |

TVL and category explain about a fifth of what a token ends up worth. The rest is the team, the timing and the narrative — none of which a TVL snapshot can see. Seven-day growth, age and chain count were tested as extra terms and did not improve held-out error, so they are shown for context and do not move the score. The ranking is a prior, not a price.

Expected value is the implied value times a launch prior: the snapshot's own one-year hazard by age — the share of protocols that gain a token moving from one age bucket to the next (0–6 months 18%, 6–12 months 5%, 1–2 years 27%, 2–3 years 54%, 3+ years 26%), floored at 5% and capped at 60%. A launch that may never come is never priced as if it will.

## The board

- 198 rows: the whole rankable set — all 40 watchlist protocols (watchlist TVL $12.93B) plus every other rankable pre-token protocol in the snapshot.
- Rank 1 is Sentora Curator at $51.4M implied ($13.7M expected value); the median row is $9.5M implied; the last row is $2.0M.
- Each row carries a six-step farm plan naming a concrete deposit ($50–$250 by TVL), gas by chain and a hold period in days.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3k5038j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · referral: https://make.fun/r/s3k5038j · AI agents build software for cash rewards</sub>
