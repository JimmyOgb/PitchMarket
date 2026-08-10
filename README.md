# ⚽ PitchMarket

> **Decentralized football prediction markets powered by GenLayer**

PitchMarket is an on-chain football prediction market where users can
create match markets, choose an outcome, and place GEN-denominated bets.
Market state and betting accounting are maintained by a GenLayer
intelligent contract, while the Next.js frontend provides the
user-facing trading experience.

The project is designed around a simple idea:

**Football prediction markets should be transparent, verifiable, and
governed by on-chain state rather than a centralized database.**

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#overview)
-   [Why PitchMarket](#why-pitchmarket)
-   [Core Features](#core-features)
-   [How It Works](#how-it-works)
-   [Architecture](#architecture)
-   [Technology Stack](#technology-stack)
-   [GenLayer Contract](#genlayer-contract)
-   [Market Lifecycle](#market-lifecycle)
-   [Betting Rules](#betting-rules)
-   [Frontend and RPC Architecture](#frontend-and-rpc-architecture)
-   [Project Structure](#project-structure)
-   [Environment Variables](#environment-variables)
-   [Local Development](#local-development)
-   [Production Deployment](#production-deployment)
-   [Smart Contract Deployment](#smart-contract-deployment)
-   [Testing](#testing)
-   [Security and Design
    Considerations](#security-and-design-considerations)
-   [Known Limitations](#known-limitations)
-   [Roadmap](#roadmap)
-   [Demo Flow](#demo-flow)
-   [Troubleshooting](#troubleshooting)
-   [Contributing](#contributing)
-   [License](#license)

------------------------------------------------------------------------

## Overview

PitchMarket turns football fixtures into decentralized prediction
markets.

A market represents a football match and supports three possible
outcomes:

  Outcome   Meaning
  --------- ----------
  `0`       Home win
  `1`       Draw
  `2`       Away win

A creator initializes the market with the fixture information and a
creator prediction. Users can then connect their wallet and place
GEN-denominated bets on an outcome.

The intelligent contract maintains the authoritative market state,
including:

-   Market ID
-   Home team
-   Away team
-   Kickoff time
-   Fixture ID
-   Market creator
-   Creator prediction
-   Market status
-   Total amount staked
-   Outcome totals
-   Individual bet records
-   Settlement state

The frontend does not maintain a separate database of balances or bets.
It reads the market state from GenLayer.

------------------------------------------------------------------------

# Why PitchMarket?

Traditional prediction platforms require users to trust a centralized
operator to:

1.  Record their prediction.
2.  Hold their funds.
3.  Maintain the market state.
4.  Determine the result.
5.  Credit winnings.

PitchMarket moves the core market state and betting accounting on-chain.

This provides:

-   **Transparency** --- market state is publicly readable.
-   **Verifiability** --- transactions can be inspected on the GenLayer
    network.
-   **Non-custodial interaction** --- users sign transactions with their
    own wallets.
-   **Deterministic accounting** --- stake totals are maintained by the
    intelligent contract.
-   **GenLayer-native execution** --- the application is designed around
    GenLayer's intelligent contract model.

------------------------------------------------------------------------

# Core Features

## 1. Football Market Creation

A market creator specifies:

-   Home team
-   Away team
-   Kickoff time
-   Football API fixture ID
-   Creator outcome

Example:

``` text
Arsenal vs Chelsea
Kickoff: 2026-08-10 19:00
Fixture ID: 123456
Creator prediction: Home win
```

The contract creates a new market ID.

------------------------------------------------------------------------

## 2. Three-Way Match Prediction

Each market supports:

``` text
0 = Home
1 = Draw
2 = Away
```

This keeps the MVP focused on the standard football match-winner market.

------------------------------------------------------------------------

## 3. GEN Betting

Users place bets using GEN.

The contract is payable, meaning the stake is supplied as the
transaction value rather than as a normal contract argument.

Conceptually:

``` text
place_bet(market_id, outcome)
value = stake in wei
```

For example:

``` text
Stake = 1 GEN
```

is submitted as:

``` text
1000000000000000000 wei
```

------------------------------------------------------------------------

## 4. On-Chain Pool Accounting

When a valid bet succeeds, the contract updates:

``` text
market.total_staked
```

and:

``` text
outcome_totals[market_id][outcome]
```

The frontend derives the market state from these values.

For example:

``` text
Total pool: 1.0000 GEN
Status: ACTIVE
```

------------------------------------------------------------------------

## 5. Wallet-Based Transactions

PitchMarket does not ask users for private keys.

The browser wallet signs transactions through the EIP-1193 provider
exposed by the wallet.

The application uses `genlayer-js` for GenLayer interaction and a wallet
connector for user signing.

------------------------------------------------------------------------

## 6. Optimistic Market UI

After a successful wallet submission, the frontend immediately updates
the affected market using the submitted stake.

This means the user does not have to wait for an additional page refresh
before seeing:

``` text
ACTIVE
1.0000 GEN
```

The frontend then reconciles the displayed state with the on-chain
contract state.

------------------------------------------------------------------------

# How It Works

The basic user flow is:

``` text
                  ┌─────────────────────┐
                  │   PitchMarket UI    │
                  │     Next.js         │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   Wallet Provider   │
                  │   EIP-1193 / Wallet │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │     genlayer-js     │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ GenLayer Studionet  │
                  │     Chain 61999     │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ PitchMarket Contract│
                  └─────────────────────┘
```

------------------------------------------------------------------------

# Architecture

## Frontend

The frontend is built with Next.js and provides:

-   Market discovery
-   Market creation
-   Wallet connection
-   Betting UI
-   Market state display
-   Transaction feedback
-   Error handling
-   Responsive market cards

------------------------------------------------------------------------

## Intelligent Contract

The contract is responsible for:

-   Creating markets
-   Validating bets
-   Recording bets
-   Updating pool totals
-   Tracking outcome totals
-   Tracking settlement state
-   Exposing market state to the frontend

The contract is the source of truth for financial and market accounting.

------------------------------------------------------------------------

## Football Data

The frontend uses a football fixture API to discover match data.

The API key is kept server-side rather than exposed directly to the
browser.

The architecture is:

``` text
Browser
   │
   ▼
Next.js API route
   │
   ▼
Football API
```

This prevents the football API credential from being bundled into the
client application.

------------------------------------------------------------------------

# Technology Stack

## Frontend

-   Next.js 15
-   React
-   TypeScript
-   Tailwind CSS
-   React Query
-   Framer Motion
-   Axios
-   Lucide React
-   React Hot Toast

## Blockchain

-   GenLayer
-   GenLayer Studionet
-   `genlayer-js`
-   Wagmi
-   Viem
-   EIP-1193 wallet provider

## Contract

-   Python
-   GenLayer intelligent contract framework

## Data

-   Football fixture API
-   Server-side Next.js API route

------------------------------------------------------------------------

# GenLayer Network

The current deployed PitchMarket contract is on:

``` text
Network: GenLayer Studionet
Chain ID: 61999
```

Current contract:

``` text
0x0B7CB2FEbf680dC2b5d1b60a374b5D9d5aE269f3
```

The contract was redeployed after correcting the creator betting rule.

The frontend must always point to the currently deployed contract
address.

------------------------------------------------------------------------

# GenLayer Contract

The core contract is located at:

``` text
contract/market.py
```

The primary public methods are:

``` python
create_market(
    home_team,
    away_team,
    kickoff_time,
    fixture_id,
    creator_outcome
)
```

and:

``` python
place_bet(
    market_id,
    outcome
)
```

------------------------------------------------------------------------

## `create_market`

Signature:

``` text
create_market(
    string home_team,
    string away_team,
    string kickoff_time,
    string fixture_id,
    int creator_outcome
)
```

The method is non-payable.

The creator prediction must be one of:

``` text
0 = Home
1 = Draw
2 = Away
```

The method validates the required market information before storing the
market.

------------------------------------------------------------------------

## `place_bet`

Signature:

``` text
place_bet(
    int market_id,
    int outcome
)
```

The method is payable.

The bet amount is supplied through transaction value.

Example:

``` text
Arguments:
[0, 2]

Transaction value:
1 GEN
```

The contract then records the bet and updates market accounting.

------------------------------------------------------------------------

# Market Lifecycle

A market progresses conceptually through:

``` text
OPEN
  │
  │ first successful bet
  ▼
ACTIVE
  │
  │ match reaches resolution stage
  ▼
RESOLVING
  │
  ├───────────────┐
  ▼               ▼
RESOLVED          VOID
```

The current frontend displays the market as:

``` text
WAITING
```

when:

``` text
total_staked == 0
```

and:

``` text
ACTIVE
```

when:

``` text
total_staked > 0
```

This distinction is important: `ACTIVE` in the UI is derived from actual
stake state and is not simply a visual flag stored independently by the
frontend.

------------------------------------------------------------------------

# Betting Rules

The current contract contains an important creator rule.

The creator cannot place a bet against their own declared prediction.

For example, if the creator chooses:

``` text
Home win
```

the creator cannot place:

``` text
Away win
```

However, the corrected contract allows a non-creator to choose either
outcome.

The effective rule is:

``` text
Creator:
    creator outcome      → allowed
    opposing outcome    → rejected

Non-creator:
    creator outcome      → allowed
    opposing outcome    → allowed
```

This was intentionally changed from the earlier contract behavior.

The previous deployment rejected all creator-outcome bets, including
valid non-creator bets. That restriction was removed.

------------------------------------------------------------------------

# Frontend and RPC Architecture

The browser cannot directly fetch the GenLayer Studionet RPC endpoint
because of browser CORS restrictions.

PitchMarket therefore uses a same-origin server-side RPC proxy.

``` text
Browser
   │
   │ JSON-RPC
   ▼
/api/genlayer-rpc
   │
   │ server-side request
   ▼
https://studio.genlayer.com/api
```

The proxy is located at:

``` text
frontend/app/api/genlayer-rpc/route.ts
```

This architecture prevents the browser from directly making cross-origin
requests to the GenLayer HTTP RPC endpoint.

------------------------------------------------------------------------

## Important Wallet Distinction

The RPC proxy is only for HTTP RPC operations.

Wallet signing remains separate.

Conceptually:

``` text
READS / SDK RPC
Browser
   ↓
/api/genlayer-rpc
   ↓
GenLayer Studionet

TRANSACTION SIGNING
Browser
   ↓
Wallet
   ↓
window.ethereum
   ↓
GenLayer transaction
```

The application does not proxy private keys or wallet signatures through
the server.

------------------------------------------------------------------------

# RPC Rate Limiting

GenLayer RPC requests are rate-limited.

The frontend therefore avoids unnecessary repeated reads.

The current architecture includes:

-   Read caching
-   In-flight/result reuse
-   No continuous transaction polling
-   No receipt polling loop
-   No automatic transaction resubmission
-   No duplicate write caused by refresh
-   Outcome totals loaded when relevant rather than for every market on
    initial page load

This is especially important for the markets page.

A naive implementation can produce dozens of `gen_call` requests during
one initial render, particularly under React development/Strict Mode.

PitchMarket reduces that request volume substantially.

------------------------------------------------------------------------

# Transaction Handling

## Place Bet

The frontend performs:

``` text
User enters stake
        ↓
parseEther(stake)
        ↓
placeBet(marketId, outcome, amount)
        ↓
writeMarketContract()
        ↓
genlayer-js writeContract()
        ↓
Wallet signs transaction
        ↓
Transaction hash
        ↓
Optimistic UI update
        ↓
One reconciliation read
```

The transaction value is the stake.

The contract arguments remain:

``` text
[market_id, outcome]
```

The stake is not duplicated as a contract argument.

------------------------------------------------------------------------

# Duplicate Submission Protection

The Place Bet action uses a synchronous submission lock.

This prevents:

``` text
Double click
    ↓
Two transactions
    ↓
Two stakes
```

Instead:

``` text
First click
    ↓
Submission lock
    ↓
Transaction
    ↓
Hash
    ↓
Unlock
```

This is particularly important for financial transactions.

------------------------------------------------------------------------

# Optimistic UI

When a transaction hash is returned, PitchMarket immediately updates the
displayed market.

For example, if:

``` text
Current pool = 0 GEN
Submitted stake = 1 GEN
```

the frontend temporarily displays:

``` text
Pool = 1 GEN
Status = ACTIVE
```

The frontend then performs a single fresh market read to reconcile the
optimistic state with the blockchain.

If the reconciliation read fails temporarily, the optimistic state is
preserved rather than causing the UI to revert to stale data.

------------------------------------------------------------------------

# Project Structure

The repository is organized approximately as follows:

``` text
pitchmarket/
│
├── contract/
│   ├── market.py
│   └── tests/
│       └── test_market_direct.py
│
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fixtures/
│   │   │   └── genlayer-rpc/
│   │   │       └── route.ts
│   │   │
│   │   ├── markets/
│   │   │   └── page.tsx
│   │   │
│   │   └── ...
│   │
│   ├── components/
│   │
│   ├── services/
│   │   ├── genlayer.ts
│   │   └── market.ts
│   │
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
│
├── docs/
├── README.md
└── .gitignore
```

------------------------------------------------------------------------

# Environment Variables

Create:

``` text
frontend/.env.local
```

The exact variables depend on the current frontend configuration.

The most important production configuration is the deployed contract
address:

``` text
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x0B7CB2FEbf680dC2b5d1b60a374b5D9d5aE269f3
```

The football API credential should remain server-side.

Example:

``` text
API_FOOTBALL_KEY=your_key_here
```

Do not expose secret credentials using `NEXT_PUBLIC_*`.

------------------------------------------------------------------------

# Local Development

## Requirements

Recommended:

-   Node.js 20+
-   npm
-   Python 3.11+
-   A compatible GenLayer development environment
-   A browser wallet
-   GenLayer Studionet access

------------------------------------------------------------------------

## Install Frontend Dependencies

``` powershell
cd frontend
npm install
```

------------------------------------------------------------------------

## Start Development Server

``` powershell
npm run dev
```

The application is normally available at:

``` text
http://localhost:3000
```

------------------------------------------------------------------------

## Run TypeScript Validation

``` powershell
npm run typecheck
```

If the repository uses a different script name, inspect:

``` powershell
npm run
```

------------------------------------------------------------------------

## Run Lint

``` powershell
npm run lint
```

------------------------------------------------------------------------

## Production Build

``` powershell
npm run build
```

A production build should complete successfully before deployment.

------------------------------------------------------------------------

# Smart Contract Testing

The contract tests are located under:

``` text
contract/tests/
```

The direct market tests cover:

-   Market creation
-   Creator betting
-   Creator opposing bet rejection
-   Non-creator betting
-   Outcome accounting
-   Total stake accounting
-   Failed transaction accounting
-   Market state consistency

The corrected contract has been validated with:

``` text
13 tests passed
```

The contract also passed:

-   GenVM lint
-   Contract type checking
-   ABI/schema validation

------------------------------------------------------------------------

# Production Deployment

PitchMarket is a Next.js application and can be deployed to a serverless
platform such as Vercel.

For Vercel, configure:

``` text
Root Directory:
frontend
```

The application should use:

``` text
Framework:
Next.js
```

Build command:

``` text
npm run build
```

Add all required environment variables in the hosting provider's
production environment.

Do not upload `.env.local` to GitHub.

------------------------------------------------------------------------

# Vercel Deployment Checklist

Before deploying:

``` text
[ ] Contract address points to the latest deployment
[ ] Chain ID is 61999
[ ] GenLayer RPC proxy exists
[ ] Football API key is configured server-side
[ ] TypeScript passes
[ ] ESLint passes
[ ] Production build passes
[ ] No private keys are in source code
[ ] No .env.local file is committed
```

After deployment:

``` text
[ ] Homepage loads
[ ] Markets page loads
[ ] Wallet connects
[ ] Studionet is selected
[ ] Existing markets load
[ ] Market pool displays correctly
[ ] Create Market works
[ ] Place Bet works
[ ] Pool updates after betting
[ ] Market changes to ACTIVE
[ ] No persistent RPC 429 errors
[ ] No CORS errors
```

------------------------------------------------------------------------

# Security and Design Considerations

## Never Store Private Keys in the Frontend

PitchMarket expects the user's wallet to sign transactions.

Never put:

``` text
PRIVATE_KEY=
```

or equivalent wallet secrets in:

``` text
NEXT_PUBLIC_*
```

or frontend source code.

------------------------------------------------------------------------

## Contract Is the Source of Truth

The frontend's optimistic state is only a user-experience improvement.

The authoritative state remains the GenLayer contract.

For example:

``` text
Frontend:
1.0000 GEN
```

should ultimately reconcile against:

``` text
market.total_staked
```

from the contract.

------------------------------------------------------------------------

## Optimistic UI Is Not Accounting

The frontend must never be treated as the authority for:

-   balances
-   stake totals
-   winnings
-   settlement
-   market ownership

Those values belong to the contract.

------------------------------------------------------------------------

## Transaction Hash Is Not Execution Success

A submitted transaction hash means the transaction was
accepted/submitted to the network.

It does not necessarily mean the contract execution succeeded.

This distinction became important during development when an earlier
`place_bet` transaction was finalized but the contract execution
rejected it.

Therefore production UI should distinguish:

``` text
Submitted
```

from:

``` text
Executed successfully
```

where the available network lifecycle data permits that distinction.

------------------------------------------------------------------------

# Important Historical Contract Issue

The previous PitchMarket deployment contained a creator betting
restriction that was too broad.

The old behavior effectively rejected:

``` text
outcome == creator_outcome
```

for everyone.

This meant legitimate non-creators could not bet on the creator's
prediction.

The corrected contract changed the rule so that the restriction applies
only when:

``` text
bettor == market.creator
```

and the bettor attempts to choose the opposing outcome.

The corrected logic is:

``` python
if bettor == market.creator and outcome != market.creator_outcome:
    raise gl.vm.UserError("Bet must oppose the creator outcome")
```

The new contract was deployed separately, and the frontend was updated
to use only the new address.

------------------------------------------------------------------------

# Historical Funds Incident

During development, several failed bets were submitted against the
previous deployment.

Those transactions carried GEN value and reached contract execution, but
the contract's old betting rule rejected them.

The previous contract did not contain a refund/withdrawal method capable
of safely recovering those credited funds through the existing ABI.

The current PitchMarket deployment is separate from that old contract.

**Do not treat the old contract balance as part of the current
PitchMarket market pool.**

The current frontend points to the corrected deployment:

``` text
0x0B7CB2FEbf680dC2b5d1b60a374b5D9d5aE269f3
```

------------------------------------------------------------------------

# Known Limitations

PitchMarket is currently an MVP.

The following areas may require further development before handling real
economic activity at scale.

## 1. Settlement

The full production settlement pipeline should be hardened before
treating the application as a mature prediction market.

This includes:

-   Trusted fixture identification
-   Approved resolution sources
-   Robust result verification
-   Deterministic outcome normalization
-   Resolution consensus
-   Final settlement
-   Winner accounting
-   Claim processing

------------------------------------------------------------------------

## 2. Escrow and Withdrawal Model

The contract's economic model should be reviewed carefully before
accepting significant value.

A production-grade market should explicitly define:

-   Where stakes are held
-   Who can resolve
-   How winners are calculated
-   How fees are handled
-   How refunds work
-   What happens when a match is cancelled
-   What happens when data sources disagree

------------------------------------------------------------------------

## 3. Market Cutoff

A production market should prevent bets after the appropriate kickoff
cutoff.

The cutoff should be enforced by the contract rather than relying
exclusively on frontend UI.

------------------------------------------------------------------------

## 4. Oracle/Resolution Security

Football results must come from trustworthy and appropriately
constrained data sources.

A production version should avoid arbitrary user-provided resolution
URLs.

------------------------------------------------------------------------

## 5. Economic Security Review

Before accepting meaningful funds, the contract should undergo an
independent security review.

This README describes the current application architecture and does not
represent a financial security audit.

------------------------------------------------------------------------

# Roadmap

## Phase 1 --- MVP

-   [x] Football fixture discovery
-   [x] Market creation
-   [x] Three-way match prediction
-   [x] GEN staking
-   [x] On-chain market accounting
-   [x] Wallet integration
-   [x] GenLayer contract
-   [x] Studionet deployment
-   [x] Corrected creator betting logic
-   [x] Optimistic pool updates
-   [x] RPC rate-limit protection
-   [x] Same-origin GenLayer RPC proxy

## Phase 2 --- Resolution

-   [ ] Production-grade fixture verification
-   [ ] Intelligent result resolution
-   [ ] Consensus-based resolution
-   [ ] Match cancellation handling
-   [ ] Automated settlement

## Phase 3 --- Economic Layer

-   [ ] Winner payout calculation
-   [ ] Claim winnings
-   [ ] Refund/void markets
-   [ ] Protocol fees
-   [ ] Liquidity model

## Phase 4 --- Production Hardening

-   [ ] Independent contract audit
-   [ ] Security monitoring
-   [ ] Transaction analytics
-   [ ] Better wallet/network error handling
-   [ ] Production RPC strategy
-   [ ] Comprehensive end-to-end testing
-   [ ] Mainnet readiness review

------------------------------------------------------------------------

# Demo Flow

A good demonstration of PitchMarket should follow this sequence.

## Step 1 --- Open the application

The user lands on the PitchMarket dashboard.

------------------------------------------------------------------------

## Step 2 --- Browse football fixtures

The application displays upcoming football matches.

------------------------------------------------------------------------

## Step 3 --- Create a market

The creator selects:

``` text
Home team
Away team
Kickoff
Fixture ID
Creator prediction
```

and submits the transaction.

------------------------------------------------------------------------

## Step 4 --- Market appears

The new market initially shows:

``` text
WAITING
0.0000 GEN
```

------------------------------------------------------------------------

## Step 5 --- Place a bet

A user selects:

``` text
Outcome: Home / Draw / Away
Stake: 1 GEN
```

and confirms the wallet transaction.

------------------------------------------------------------------------

## Step 6 --- Market becomes active

The frontend immediately reflects the submitted stake:

``` text
ACTIVE
1.0000 GEN
```

The market is then reconciled against the GenLayer contract.

------------------------------------------------------------------------

## Step 7 --- Resolution

After the match reaches its resolution stage, the intelligent contract
can determine the final result according to the configured resolution
mechanism.

------------------------------------------------------------------------

# Troubleshooting

## `Failed to fetch`

If the browser reports:

``` text
GenLayer RPC error
Failed to fetch
```

check:

1.  The `/api/genlayer-rpc` endpoint exists.
2.  The Next.js server is running.
3.  The upstream GenLayer RPC is reachable.
4.  The frontend is using the same-origin RPC proxy.
5.  The browser is not attempting to directly fetch the GenLayer RPC
    endpoint.

------------------------------------------------------------------------

## `429 Too Many Requests`

If the console reports:

``` text
Rate limit exceeded: 30 requests per minute
```

check for:

-   Polling loops
-   React effects firing repeatedly
-   Duplicate market reads
-   Per-market RPC calls during every render
-   Automatic retries
-   Duplicate wallet transaction calls

PitchMarket's current markets page intentionally limits unnecessary RPC
reads.

------------------------------------------------------------------------

## Market Says `WAITING` After a Bet

Verify the contract directly.

Check:

``` text
market.total_staked
```

If it is greater than zero, the frontend should derive:

``` text
ACTIVE
```

If the contract still reports zero, the transaction did not successfully
update the market.

A transaction hash alone is not sufficient proof of successful contract
execution.

------------------------------------------------------------------------

## Wallet on Wrong Network

PitchMarket currently targets:

``` text
GenLayer Studionet
Chain ID: 61999
```

Make sure the connected wallet is using the expected network before
submitting a transaction.

------------------------------------------------------------------------

# Contributing

Contributions are welcome.

Recommended workflow:

``` text
1. Fork the repository
2. Create a feature branch
3. Make the smallest focused change
4. Run contract tests
5. Run TypeScript checks
6. Run ESLint
7. Run production build
8. Test wallet interaction on Studionet
9. Open a pull request
```

Avoid modifying contract and frontend transaction behavior
simultaneously unless the ABI or contract semantics actually require it.

------------------------------------------------------------------------

# Development Principles

PitchMarket follows several important engineering principles:

### 1. Contract-first accounting

Financial state belongs on-chain.

### 2. Wallet-first signing

Private keys remain with the user's wallet.

### 3. Minimal transaction lifecycle

Avoid unnecessary receipt polling and transaction retries.

### 4. Rate-limit awareness

RPC calls should be intentional and bounded.

### 5. Optimistic UX with reconciliation

The UI can respond immediately, but the blockchain remains
authoritative.

### 6. Server-side secrets

API credentials remain on the server.

### 7. Small contract changes

Contract modifications should preserve the existing ABI whenever
possible.

------------------------------------------------------------------------

# Current Deployment

## Frontend

Production deployment target:

``` text
Vercel / Cloudflare
```

The production URL should be added here after deployment:

``` text
https://YOUR-PITCHMARKET-DOMAIN
```

## GenLayer Contract

``` text
Network: GenLayer Studionet
Chain ID: 61999

Contract:
0x0B7CB2FEbf680dC2b5d1b60a374b5D9d5aE269f3
```

------------------------------------------------------------------------

# Project Submission Summary

PitchMarket demonstrates how GenLayer can be used as the
intelligent-contract layer for a football prediction market.

The project combines:

-   Real football fixtures
-   A decentralized market model
-   GEN-denominated staking
-   Wallet-based transactions
-   On-chain accounting
-   Intelligent contract execution
-   GenLayer's network infrastructure
-   A modern Next.js interface

The central product experience is intentionally simple:

``` text
Choose a match
      ↓
Create or enter a market
      ↓
Choose Home / Draw / Away
      ↓
Stake GEN
      ↓
Market becomes ACTIVE
      ↓
Result is resolved
      ↓
Winning positions are settled
```

PitchMarket's long-term goal is to provide a transparent football
prediction market where market state, staking, and resolution are
governed by decentralized infrastructure rather than a centralized
betting operator.

------------------------------------------------------------------------

# License

Add the project's chosen license here.

For example:

``` text
MIT License
```

If no license has been selected yet, do not assume that the project is
open-source licensed.

------------------------------------------------------------------------

# Status

**Current status: Project MVP / Studionet**

The current deployment has successfully demonstrated:

-   Market creation
-   Wallet interaction
-   GEN staking
-   On-chain stake accounting
-   ACTIVE market state
-   Corrected creator/non-creator betting behavior
-   GenLayer Studionet integration
-   Next.js frontend integration

The application should be considered a project MVP rather than a
production financial platform until settlement, economic security,
oracle security, and contract auditing are completed.
