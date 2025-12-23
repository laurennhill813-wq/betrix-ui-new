# Fixture Analysis: Explainability & Risk Guardrails

## Purpose

This document defines how BETRIX presents fixture analysis to users: what inputs drive predictions, how models make decisions, and what risks apply. **No deterministic language.** **Always attach uncertainty.**

---

## 1. Explainable Prediction Structure

### User-Facing Narrative (Example)

```
# Manchester City vs Arsenal
Prediction: City 65% | Draw 20% | Arsenal 15%
Confidence: High | Risk Level: ⚠️ Moderate

## What Drives This?

📊 Recent Form
  • City: 4 wins, 1 loss (last 5) — strong offensive, slight defensive fatigue
  • Arsenal: 5 wins, 0 losses (last 5) — peak form
  → Form edge: Arsenal (raw), but City's depth matters

⚽ Head-to-Head (Last 5 matches)
  • City 2 wins, Arsenal 2 wins, 1 draw
  • Average goals per match: 3.2
  → Slight City edge, but volatile series

🏥 Team News
  • City: Rodri absent (midfielder, -2% chance of win) — scouts data
  • Arsenal: Full squad

⏱️ Rest & Travel
  • City: 3 days rest, traveled 2500km midweek
  • Arsenal: 5 days rest, home
  → Arsenal advantage: +3% implied probability

💰 Market Liquidity
  • Betting depth: Deep (>$10M at top 10 sportsbooks)
  • Implied City probability: 62% (from market odds)
  → Our model: 65% — 3% edge opportunity

## Model Components

| Component | Input | Weight | Output |
|-----------|-------|--------|--------|
| Rating System | Elo/Glicko | 35% | City +80, Arsenal +70 |
| Recent Form | Avg Goals, xG | 25% | Arsenal +4 |
| Injuries | Availability, impact | 15% | City -2 |
| Rest/Travel | Days, distance | 10% | Arsenal +3 |
| Market Consensus | Implied prob | 15% | City +3 |

**Aggregate (weighted):** City 65%, Draw 20%, Arsenal 15%

## Uncertainty & Confidence

### High Confidence (±5 percentage points)
- Deep liquid markets
- Large historical dataset
- Recent stable form
- No injury surprises

### Moderate Confidence (±10 percentage points)
- Moderate liquidity
- New manager or formation
- Key injury
- Unusual rest patterns

### Low Confidence (±15+ percentage points)
- Newly promoted teams
- Thin markets
- Multiple key injuries
- Recent radical roster changes

**This prediction: Moderate confidence**
→ Fair-value range: City 55–75%

## Calibration

We track how often our 65% predictions come true:
- Historical outcome rate for "65% predictions": 63% ✓ (calibrated)
- This builds trust in uncertainty ranges
```

---

## 2. Input Variables & Data Sources

### Categorical Inputs

| Input | Source | Refresh | Reliability |
|-------|--------|---------|-------------|
| **Team Rating** | EloRatings / Glicko | Daily | ⭐⭐⭐⭐⭐ |
| **Recent Form** | Last 20 matches | Daily | ⭐⭐⭐⭐⭐ |
| **Head-to-Head** | Historical fixture history | Static | ⭐⭐⭐⭐ |
| **Injuries** | TransferMarkt / team news | Real-time | ⭐⭐⭐⭐ |
| **Rest Days** | Schedule | Known ahead | ⭐⭐⭐⭐⭐ |
| **Home/Away** | Fixture location | Known ahead | ⭐⭐⭐⭐⭐ |
| **Weather** | Historical averages | Seasonal | ⭐⭐⭐ |
| **Fixture Congestion** | Calendar | Known ahead | ⭐⭐⭐⭐⭐ |
| **Manager Stability** | News feeds | Ad-hoc | ⭐⭐⭐ |
| **Market Odds** | Multiple sportsbooks | Real-time | ⭐⭐⭐⭐⭐ |

### Key Derivations

**Elo/Glicko Ratings** (0–3000 scale)
- Advantage: Captures long-term performance trends, accounts for margin of victory
- Limitation: Slow to respond to radical roster changes

**Expected Goals (xG)**
- Definition: Quality-weighted shot count
- Usage: Separates "luck" (conversion) from "performance" (shot generation)
- Limitation: Noisy with small sample sizes (<10 shots)

**Rest Advantage**
- Proxy: Days since last match
- Dosage: -2% win prob per day below team average rest
- Cap: +8% max for extreme rest advantage (avoiding diminishing returns)

---

## 3. Model Outputs & Calibration

### Probability Outputs
```
P(Win)  + P(Draw) + P(Loss) = 100%
```

**Example calibration check (rolling 30 days):**
```
Prediction Range | Expected Frequency | Actual Frequency | Calibration
1-10%            | 5.5%               | 6.2%             | ✓ Good
11-20%           | 15.5%              | 14.8%            | ✓ Good
21-30%           | 25.5%              | 23.1%            | ✓ Good
31-40%           | 35.5%              | 36.2%            | ✓ Good
41-50%           | 45.5%              | 47.1%            | ✓ Good
51-60%           | 55.5%              | 54.9%            | ✓ Good
61-70%           | 65.5%              | 66.3%            | ✓ Good
71-80%           | 75.5%              | 73.9%            | ✓ Good
81-90%           | 85.5%              | 84.2%            | ✓ Good
91-100%          | 95.5%              | 93.8%            | ✓ Good

Overall Brier Score: 0.152 (lower = better; 0 = perfect, 0.25 = always guessing 50%)
Log Loss: 0.389 (measures uncertainty penalty for misses)
```

---

## 4. Market Edge & Fair Odds

### Vig-Adjusted Implied Probability

**Example:**
```
Sportsbook (FOX Bet):
  City: -140 (implied prob: 58.3%)
  Draw: +290 (implied prob: 25.6%)
  Arsenal: +220 (implied prob: 31.3%)
  
Vig: 115.2% (overround; bookmaker margin)

Our Model: City 65%
Edge: 65% - 58.3% = +6.7 percentage points

Fair Odds (0% vig):
  City: 65% → -186 decimal 1.54
  Draw: 20% → +400 decimal 5.00
  Arsenal: 15% → +567 decimal 6.67
```

**Recommendation:** City at -140 offers +6.7% fair value.

---

## 5. Risk Guardrails

### Market Sanity Checks

**Flag if:**
- Implied probability outside [5%, 95%] (extreme skew)
- Liquidity < $1M at top bookmaker (thin market, bid-ask spread likely)
- 24h odds movement > 10 percentage points (volatility; possible insider action or error)
- Model vs. Market divergence > 15 percentage points (huge outlier; review inputs)

**Action:**
- Reduce confidence by 50%
- Add warning banner: "⚠️ Unusual market conditions; use with caution"
- Surface reason: "Thin liquidity" vs. "Extreme odds move"

### Injury Impact Gradation

```
Position | Team Type | Star Player | Squad Depth | Impact
Striker  | Top-4    | Haaland     | Deep        | -5% to -8%
Striker  | Bottom   | Key scorer  | Shallow     | -12% to -15%
Midfield | Top-4    | Creative    | Deep        | -3% to -5%
Midfield | Bottom   | Key player  | Shallow     | -8% to -10%
Defender | Top-4    | CB/RB       | Deep        | -1% to -3%
Defender | Bottom   | Key player  | Shallow     | -5% to -8%
GK       | Any      | #1 keeper   | Backup weak | -4% to -7%
```

**Example:** City minus Rodri (creative midfield) = -3% to -5%. Used -2% above (conservative, reflects depth).

### New Manager Discount

```
Manager Tenure | Form Impact | Confidence Discount
< 2 weeks     | Not used     | -30% (extreme caution)
2-4 weeks     | Partial (50%)| -20%
4-12 weeks    | Full        | 0%
Stable (>1yr) | Full        | 0%
```

### Low-Liquidity Threshold

- **Deep market:** > $10M total liability → use model as-is
- **Moderate:** $1M–$10M → apply -15% confidence
- **Thin:** < $1M → don't publish; or flag "⚠️ Insufficient liquidity"

---

## 6. Safe Copywriting Standards

### ❌ Never Say
```
"City are guaranteed to win"
"Arsenal will definitely lose"
"Lock this bet in"
"This is a sure thing"
"You should bet on..."
"Free money at these odds"
```

### ✅ Always Say
```
"Our model assigns 65% probability to City"
"Historical calibration suggests 65% predictions come true ~65% of the time"
"At -140 odds, City offers +6.7 percentage points of value vs. our fair odds"
"This is a moderate-confidence prediction; fair-value range is 55–75%"
"Past performance doesn't guarantee future results"
"Always practice responsible betting; only wager what you can afford to lose"
```

### Responsible Betting Notice

Display on all prediction pages:

```
⚠️ RESPONSIBLE BETTING NOTICE

Betting involves risk of financial loss. Our predictions are model outputs 
based on historical data; they do not guarantee outcomes and should not be 
treated as financial advice.

- Only bet what you can afford to lose
- Understand the odds and your stake
- Set loss limits; stick to them
- Seek help if you suspect problem gambling

National Council on Problem Gambling: 1-800-GAMBLER (1-800-426-2537)
GamCare (UK): www.gamcare.org.uk
```

---

## 7. Explainability Checklist for Each Prediction

- [ ] **Prediction stated as probability range:** "City 65% (±10%)"
- [ ] **Top 3 input drivers explained:** Form, Rodri absence, rest
- [ ] **Model components shown:** Table of ratings, xG, rest, market
- [ ] **Uncertainty quantified:** "Moderate confidence; 55–75% fair range"
- [ ] **Calibration cited:** "Our 65% predictions historically come true 63% of the time"
- [ ] **Market edge shown (if positive):** "+6.7 percentage points vs. -140 odds"
- [ ] **Risks flagged:** Any unusual market, injury surprises, or data gaps
- [ ] **Safe copy used:** No deterministic language
- [ ] **Responsible notice visible:** Always
- [ ] **Easy-to-understand tables/charts:** Jargon minimized

---

## 8. Backtesting & Versioning

### Backtesting Rigor

**Prevent data leakage:**
```
Fixture Date: 2025-05-10
Prediction Generated: 2025-05-08
Data Cutoff: 2025-05-08 23:59:59 UTC
  ✓ Only prior form, historical H2H, known injuries
  ✗ Not: final team news from match day
  ✗ Not: last-minute lineup changes
```

**Dataset Versioning:**
```
Dataset: Premier League 2024–2025
Horizon: 2025-05-08 to 2025-05-31 (30 days)
Fixtures: 120 matches
Historical: 2017–2024 (7 seasons)
Held-out test set: 30 matches (unseen until evaluation)

Brier Score (test): 0.151
Log Loss (test): 0.391
Calibration: Good (see section 3)
Model version: v2.3.1 (released 2025-01-15)
```

### Model Changelog

```
# v2.3.1 (2025-01-15)
- Added rest-advantage input (±8% impact)
- Recalibrated injury impact table
- Increased market-consensus weight to 15%

# v2.3.0 (2025-01-10)
- Integrated TransferMarkt injury API
- Fixed xG calculation for penalty-heavy matches
- Added league-specific Elo adjustments

# v2.2.5 (2024-12-20)
- Brier Score: 0.159 → 0.152 (improvement)
- Recalibrated 71–90% and 91–100% buckets
```

---

## 9. Real-time Update Heuristics

### When to Recompute

- **Every 6 hours:** Market odds refresh (affects edge calculation)
- **On injury news:** Re-rank impact, adjust probability ±3%
- **On manager change:** Apply new-manager discount, flag confidence reduction
- **On weather update:** Rare, but high-wind/extreme-cold matches get adjusted ±2%
- **On data drift:** If actual outcomes deviate from calibration curve, audit model

### Versioning Live Predictions

```
Prediction ID: MCI-ARS-20250510-V3
Version: 3 (updated 6 hours before match)
Generated: 2025-05-08 12:00:00 UTC
Updated: 2025-05-10 14:00:00 UTC (reason: injury news)

City 65% (previous 62%, +3% from Rodri return confirmation)
Draw 20% (unchanged)
Arsenal 15% (previous 23%, -8% from last-minute bench news)

Confidence: Moderate → High (+injury clarity)
Fair-value range: 55–75% → 60–70% (narrowed)
```

---

## 10. Testing & Validation

### Unit Tests

```typescript
describe('Fixture Analysis', () => {
  it('should explain all prediction inputs', () => {
    const prediction = model.predict(mci_vs_ars);
    expect(prediction.explanation.drivers).toHaveLength(3);
    expect(prediction.explanation.confidence).toBeDefined();
    expect(prediction.explanation.calibration).toBeDefined();
  });

  it('should flag low-liquidity markets', () => {
    const thin_market = { odds: [...], liquidity_usd: 500000 };
    const prediction = model.predict(thin_market);
    expect(prediction.warnings).toContain('thin liquidity');
    expect(prediction.confidence).toBeLessThan(0.75);
  });

  it('should never use deterministic language', () => {
    const text = generateNarrative(prediction);
    expect(text).not.toMatch(/guaranteed|sure thing|lock|will definitely/i);
  });

  it('should cite responsible betting notice', () => {
    const output = render(prediction);
    expect(output).toContain('RESPONSIBLE BETTING NOTICE');
  });
});
```

---

## 11. Implementation Roadmap

- [x] Define explainability structure and inputs
- [x] Create model output and calibration standards
- [x] Define risk guardrails (market sanity, injuries)
- [ ] Implement safe-copy linter (block deterministic phrases)
- [ ] Create backtesting harness with leakage checks
- [ ] Instrument calibration tracking dashboard
- [ ] Create fixture narrative template & tests
- [ ] Deploy health checks for model drift
- [ ] Launch A/B test: explainability vs. simple predictions

---

**Version:** 1.0  
**Last Updated:** 2025-12-23  
**Owner:** BETRIX Data & Risk  
**Related:** QUALITY_GATES.md, MERGE_STATUS.md
