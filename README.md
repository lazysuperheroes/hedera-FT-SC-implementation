# @lazysuperheroes/hedera-ft-sc

Hedera Fungible Token Smart Contract Treasury -- creates and manages immutable fungible tokens via a no-keys smart contract treasury pattern.

**Author:** [Lazy Super Heroes team](https://github.com/lazysuperheroes)
**License:** GPL-3.0
**Version:** 2.0.0

---

## What This Is

This project deploys a Solidity smart contract on Hedera that acts as a treasury for a fungible token created with **no keys whatsoever**. That means no admin key, no supply key, no freeze key, no wipe key, no KYC key, no pause key, and no fee schedule key. Once the token is minted, its supply is permanently fixed and its metadata cannot be changed by anyone -- including the contract owner. This eliminates rug-pull risk by design: the token is provably immutable from the moment of creation. The contract owner retains only operational capabilities (transferring tokens out of the treasury, managing an allowance whitelist, and withdrawing HBAR), while the token itself is beyond anyone's control.

### Security Model Overview

The contract inherits OpenZeppelin's `Ownable` for access control and uses the HTS precompile at address `0x167` for all Hedera Token Service operations. An `EnumerableSet`-based allowance whitelist restricts which addresses may receive spending allowances from the treasury.

---

## Quick Start

### Prerequisites

- **Node.js** 18.0.0 or later
- **A Hedera testnet account** with HBAR balance (get one at [portal.hedera.com](https://portal.hedera.com))
- **Git**

### 1. Clone and Install

```bash
git clone https://github.com/lazysuperheroes/hedera-ft-sc.git
cd hedera-ft-sc
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```ini
# Operator credentials (your Hedera account)
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...your-ed25519-private-key

# Environment: TEST or MAIN (also supports PREVIEW, LOCAL)
ENVIRONMENT=TEST

# Contract configuration
CONTRACT_NAME=FungibleTokenCreator
EVENT_NAME=TokenControllerMessage

# Token settings (used during minting)
TOKEN_NAME=MyToken
TOKEN_SYMBOL=MTK
TOKEN_DECIMALS=2
TOKEN_INITIALSUPPLY=100000
TOKEN_MAXSUPPLY=0
TOKEN_MEMO='My immutable fungible token'
```

Setting `TOKEN_MAXSUPPLY=0` creates an infinite-type token (supply is still fixed at `TOKEN_INITIALSUPPLY` because there is no supply key to mint more). Setting it to a positive value creates a finite-type token capped at that maximum.

### 3. Compile

```bash
npm run compile
```

Expected output: Hardhat compiles `FungibleTokenCreator.sol` and its dependencies. Artifacts are written to `artifacts/`.

### 4. Deploy the Contract

```bash
npm run deploy
```

Expected output:

```
Using *TESTNET*
- Deploying contract...
Contract deployed successfully!
  Contract ID: 0.0.XXXXXX
  Solidity Address: 0x...
Updated .env: CONTRACT_ID=0.0.XXXXXX
```

The script automatically updates `CONTRACT_ID` in your `.env` file.

### 5. Mint the Token

```bash
npm run mintToken
```

Expected output:

```
Using *TESTNET*
- Creating fungible token with no keys...
  Event: from '0.0.XXXXXX' - 'Success minting token without keys'

Token (with no keys!) created successfully!
  Token ID: 0.0.YYYYYY
  ...
Updated .env: TOKEN_ID=0.0.YYYYYY
```

This is a one-time, irreversible operation. The token is now immutable.

### 6. Associate and Transfer

Before a recipient can receive the token, they must associate it with their account. Then you can transfer tokens from the treasury:

```bash
# Associate token (run by the recipient, or via this script for operator)
npm run associateToken

# Transfer tokens from treasury to a recipient
npm run send -- -amt 100 -acct 0.0.RECIPIENT
```

---

## Available Scripts

All scripts are run via `npm run <script>`.

| Script | Command | Description |
|--------|---------|-------------|
| `compile` | `npx hardhat compile` | Compile Solidity contracts with Hardhat |
| `deploy` | `npx hardhat run scripts/deploy.js` | Deploy the FungibleTokenCreator contract |
| `mintToken` | `npx hardhat run scripts/mintToken.js` | Mint a fungible token with no keys (irreversible) |
| `interact` | `npx hardhat run scripts/interact.js` | Query contract state (balances, whitelist) |
| `send` | `node scripts/sendFungible.js` | Transfer tokens from treasury to an account |
| `setAllowance` | `node scripts/setAllowance.js` | Set spending allowance for a whitelisted address |
| `adjustWL` | `node scripts/adjustWL.js` | Add/remove addresses from the allowance whitelist |
| `associateToken` | `node scripts/associateToken.js` | Associate token with an account |
| `checkAllowance` | `node scripts/checkAllowance.js` | Check current allowance for an address |
| `transferHbar` | `node scripts/transferHbar.js` | Withdraw HBAR from the contract |
| `logs` | `node scripts/getContractLogs.js` | Fetch and decode contract event logs from mirror node |
| `info` | `node scripts/getContractInfo.js` | Get contract info (storage, balance, expiry) |
| `decodeError` | `node scripts/decodeSmartContractError.js` | Decode a smart contract error from mirror node |
| `test` | `npx hardhat test` | Run integration tests against testnet |
| `solhint` | `solhint -f table contracts/**/*.sol` | Lint Solidity files |
| `lint` | `eslint scripts/ utils/ test/` | Lint JavaScript files |

### CLI Flags

**`npm run send`**
```
Usage: node sendFungible.js -amt <amount> -acct <account> [--multisig]
  -amt     Amount to send (in token units, decimals are handled automatically)
  -acct    Recipient Hedera account (0.0.XXX)
```

**`npm run setAllowance`**
```
Usage: node setAllowance.js -amt <amount> -acct <account> [-multisig]
  -amt     Allowance amount (in token units)
  -acct    Account to grant allowance to (must be on the whitelist)
```

**`npm run adjustWL`**
```
Usage: node adjustWL.js [-add 0.0.XXXX] [-rem 0.0.XXX] [-check] [-multisig]
  -add     Add an account to the allowance whitelist
  -rem     Remove an account from the allowance whitelist
  -check   Query and display the current whitelist
```

### Multi-Sig Flag

Any script that supports `--multisig` can be run with multi-signature signing via `@lazysuperheroes/hedera-multisig`:

```bash
npm run send -- -amt 50 -acct 0.0.12345 --multisig --threshold 2 --signers "Treasury,Compliance"
```

| Flag | Description | Default |
|------|-------------|---------|
| `--multisig` | Enable multi-sig workflow | (disabled) |
| `--threshold N` | Number of signatures required | 2 |
| `--signers "A,B,C"` | Comma-separated signer labels | "Signer 1,Signer 2" |
| `--workflow TYPE` | Workflow type: `interactive`, `offline`, `web` | `interactive` |

---

## Using as a Dependency

Install the package in your own project:

```bash
npm install @lazysuperheroes/hedera-ft-sc
```

The package exports a comprehensive set of utilities for interacting with Hedera smart contracts, tokens, and the mirror node.

### Exported Modules

```javascript
const {
  // Client initialization
  createHederaClient,   // Create and configure a Hedera client from .env
  getContractConfig,    // Load CONTRACT_ID, TOKEN_ID, decimals from .env

  // ABI loading (with caching)
  loadAbi,              // Load raw ABI array for a contract
  loadInterface,        // Load ethers.Interface for a contract
  loadBytecode,         // Load contract bytecode for deployment
  loadContract,         // Load both ABI and Interface

  // Contract execution
  contractExecuteFunction,      // Execute a state-changing contract call
  contractExecuteQuery,         // Execute a read-only contract query (consensus)
  contractDeployFunction,       // Deploy a contract via ContractCreateFlow
  readOnlyEVMFromMirrorNode,    // Free read-only call via mirror node
  parseError,                   // Decode revert/panic error data
  parseErrorTransactionId,      // Decode error from a transaction ID

  // Mirror node queries (free, no HBAR cost)
  getBaseURL,            // Get mirror node base URL for environment
  checkMirrorAllowance,  // Check token allowance via mirror node
  checkMirrorBalance,    // Check token + HBAR balance via mirror node
  getTokenDetails,       // Get token metadata from mirror node
  getContractInfo,       // Get contract info from mirror node
  getContractLogs,       // Get contract event logs from mirror node
  checkLastMirrorEvent,  // Get most recent contract event

  // HTS helpers (consensus, costs HBAR)
  accountCreator,          // Create a new Hedera account
  associateTokenToAccount, // Associate a token with an account
  hbarTransfer,            // Transfer HBAR between accounts
  getAccountBalance,       // Get account token + HBAR balance
  getContractBalance,      // Get contract token + HBAR balance

  // Script helpers
  isSuccess,                    // Check if execution result was successful
  logResult,                    // Log and check execution result
  confirmOrExit,                // Y/N prompt, exits on decline
  printHeader,                  // Print standardized script header
  parseArgs,                    // Parse CLI args with help support
  formatTokenAmount,            // Format raw amount with decimals
  parseTokenAmount,             // Parse display amount to raw
  runScript,                    // Wrap async main with error handling
  updateEnvFile,                // Update a key in .env file
  getMultisigOptions,           // Parse --multisig flags from argv
  contractExecuteWithMultisig,  // Execute contract call with optional multisig

  // Constants
  GAS,              // Gas limits for common operations
  DELAYS,           // Mirror node polling intervals
  PRECOMPILES,      // Hedera system contract addresses
  TOKEN_DEFAULTS,   // Token creation defaults
} = require('@lazysuperheroes/hedera-ft-sc');
```

### Code Example: Programmatic Token Transfer

```javascript
const {
  createHederaClient,
  getContractConfig,
  loadInterface,
  contractExecuteFunction,
  GAS,
} = require('@lazysuperheroes/hedera-ft-sc');

async function transferTokens(recipientAccountId, amount) {
  // Initialize client from .env
  const { client } = createHederaClient({ requireOperator: true });
  const { contractId, contractName, tokenId, tokenDecimals } = getContractConfig();

  // Load the contract ABI
  const iface = loadInterface(contractName);

  // Convert human-readable amount to raw (accounting for decimals)
  const rawAmount = Math.floor(amount * (10 ** tokenDecimals));

  // Execute transfer via the smart contract
  const [receipt, , record] = await contractExecuteFunction(
    contractId, iface, client,
    GAS.TOKEN_TRANSFER,
    'transferHTS',
    [tokenId.toSolidityAddress(), recipientAccountId.toSolidityAddress(), rawAmount],
  );

  console.log('Transfer status:', receipt.status.toString());
  return receipt;
}
```

### Code Example: Free Balance Check via Mirror Node

```javascript
const {
  checkMirrorBalance,
} = require('@lazysuperheroes/hedera-ft-sc');

async function checkBalance(accountId, tokenId) {
  const { tokenBalance, hbarBalance } = await checkMirrorBalance(
    'TEST',       // environment
    accountId,    // account to check
    tokenId,      // token to check
  );

  console.log(`Token balance: ${tokenBalance}`);
  console.log(`HBAR balance: ${hbarBalance / 1e8}`);
}
```

---

## Smart Contract API

The `FungibleTokenCreator` contract is deployed at the address stored in your `.env` as `CONTRACT_ID`. All `onlyOwner` functions can only be called by the account that deployed the contract.

### Token Creation Functions (choose one per deployment)

The contract provides three creation modes. Choose the one that matches your trust model. Each is a one-time, irreversible action.

#### `createTokenWithNoKeys(...)` -- Maximum Transparency

*Access: `onlyOwner` | Payable (~50 HBAR)*

Creates a token with **zero keys**. Supply is permanently fixed. No burn, no mint, no freeze, no pause. Provably immutable.

#### `createFungibleWithBurn(...)` -- Deflationary

*Access: `onlyOwner` | Payable (~50 HBAR)*

Creates a token with a **Wipe Key** only (assigned to the contract). Enables the public `burn()` function so any token holder can burn their own tokens. Supply can only decrease. No re-minting.

#### `createFungibleWithSupplyAndBurn(...)` -- Full Lifecycle

*Access: `onlyOwner` | Payable (~50 HBAR)*

Creates a token with **Wipe + Supply Keys** (assigned to the contract). Enables user self-burn via `burn()`, owner burn from treasury via `burnFromTreasury()`, and owner re-mint via `mintAdditionalSupply()`. Maximum flexibility while keeping all operations contract-governed.

All three functions share the same parameters: `(string name, string symbol, string memo, int64 initialSupply, int32 decimals, int64 maxSupply) -> address`.

### Supply Management Functions

#### `mintAdditionalSupply(address token, int64 amount) -> (int responseCode, int64 newTotalSupply)`

*Access: `onlyOwner` | Requires: Supply Key (use `createFungibleWithSupplyAndBurn`)*

Mints additional tokens into the contract treasury. Amount is in the smallest unit (adjusted for decimals).

#### `burnFromTreasury(address token, int64 amount, int64[] _serials) -> (int responseCode, int64 newTotalSupply)`

*Access: `onlyOwner` | Requires: Supply Key*

Burns tokens from the contract treasury. Pass an empty array for `_serials` (used only for NFTs).

#### `burn(address token, int64 amount) -> int`

*Access: **public** | Requires: Wipe Key (use `createFungibleWithBurn` or `createFungibleWithSupplyAndBurn`)*

Burns tokens from the **caller's own account** (`msg.sender`). Anyone can burn tokens they hold -- they cannot burn anyone else's tokens. This is the deflationary mechanism.

### Transfer Functions

#### `transferHTS(address token, address receiver, int64 amount)`

*Access: `onlyOwner`*

Transfers tokens from the contract treasury to a receiver using the HTS `transferToken` precompile. The `amount` must be positive and in the smallest unit (adjusted for decimals).

#### `transfer(address token, address recipient, uint256 amount) -> bool`

*Access: `onlyOwner`*

Transfers tokens from the contract treasury using the ERC-20 `transfer` interface. Functionally equivalent to `transferHTS` but uses the ERC-20 path.

#### `batchTransferTokens(address token, address[] accountIds, int64[] amounts)`

*Access: `onlyOwner`*

Transfers tokens to multiple recipients in a single transaction. The `accountIds` and `amounts` arrays must be the same length. Useful for airdrops or batch distributions.

### Allowance Functions

#### `approveAllowance(address token, address spender, uint256 amount) -> int`

*Access: `onlyOwner`*

Grants a spending allowance to `spender` for the given token. The `spender` must already be on the allowance whitelist or the call will revert.

#### `checkAllowance(address token, address spender) -> (int responseCode, uint256 amount)`

*Access: public*

Returns the current allowance granted to `spender` for the given token. Costs HBAR as a consensus query.

#### `addAllowanceWhitelist(address newAddress)`

*Access: `onlyOwner`*

Adds an address to the allowance whitelist. Only whitelisted addresses can be granted spending allowances.

#### `removeAllowanceWhitelist(address oldAddress)`

*Access: `onlyOwner`*

Removes an address from the allowance whitelist.

### HBAR Functions

#### `transferHbar(address payable receiverAddress, uint amount)`

*Access: `onlyOwner`*

Withdraws HBAR from the contract to the specified address (amount in tinybars). Uses OpenZeppelin `Address.sendValue` for safe transfer.

### Read-Only Functions

#### `getAllowanceWhitelist() -> address[]`

*Access: public | View (no HBAR cost via mirror node)*

Returns the full list of addresses currently on the allowance whitelist.

#### `isAddressWL(address addressToCheck) -> bool`

*Access: public | View (no HBAR cost via mirror node)*

Returns `true` if the address is on the allowance whitelist.

### Receive Functions

#### `receive() external payable`

Allows the contract to accept HBAR transfers. Emits a `TokenControllerMessage` event.

#### `fallback() external payable`

Catches any call with unrecognized function selectors while accepting HBAR. Emits a `TokenControllerMessage` event.

### Events

```solidity
event TokenControllerMessage(
    string msgType,
    address indexed fromAddress,
    int64 amount,
    string message
);
```

Emitted by all state-changing operations with a descriptive `msgType` (e.g., `"MINT"`, `"Transfer with HTS"`, `"Approval"`, `"ADD WL"`, `"Hbar Transfer"`).

---

## User Flow

The complete lifecycle for deploying and operating a no-keys fungible token:

```
1. Deploy Contract
       |
       v
2. Mint Token (irreversible, no keys)
       |
       v
3. Associate Token with recipient accounts
       |       (each recipient must associate before receiving)
       v
4. Add recipients to allowance whitelist
       |       (only needed if using the allowance/approval pattern)
       v
5. Set allowance for whitelisted addresses
       |       (grants spending rights from the treasury)
       v
6. Transfer tokens
           - Direct: owner calls transferHTS() or transfer()
           - Via allowance: whitelisted spender uses HTS approved transfer
```

**Direct transfer** (steps 1-3, then 6): The contract owner calls `transferHTS` or `transfer` to send tokens from the treasury to any associated account.

**Allowance-based transfer** (all steps): The owner adds a third-party address to the whitelist, sets an allowance, and that third party can then spend tokens from the treasury up to the approved amount using the standard HTS `TransferTransaction` with `addApprovedTokenTransfer`.

---

## Contract Variants and Customization

This project ships the **no-keys** variant by default. A companion project demonstrates the **burn-enabled** variant using a Wipe Key. You can fork either as a starting point and customize further.

### Available Variants

#### 1. No-Keys (this project) -- Maximum Transparency

The default `FungibleTokenCreator.sol` creates a token with **zero HTS keys**. The token is provably immutable from the moment of creation -- no one, including the contract owner, can mint, burn, freeze, pause, or modify the token in any way. The supply is permanently fixed.

**Best for:** Community tokens, governance tokens, reward tokens where absolute transparency and "can't-be-rugged" guarantees matter most.

#### 2. Burn-Enabled (Wipe Key) -- Deflationary Token

The [hedera-SC-LAZY-FT-implementation](https://github.com/lazysuperheroes/hedera-SC-LAZY-FT-implementation) repository demonstrates a variant that adds a **Wipe Key** assigned to the contract itself. This enables a public `burn()` function that allows **any token holder to burn their own tokens**:

```solidity
// Token created with one key: WIPE_KEY assigned to the contract
IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
keys[0] = createSingleKey(
    HederaTokenService.WIPE_KEY_TYPE,
    KeyHelper.CONTRACT_ID_KEY,
    address(this)
);
token.tokenKeys = keys;
```

```solidity
// Public burn function -- anyone can burn their own tokens
function burn(address token, uint32 amount) external returns (int responseCode) {
    (responseCode) = HederaTokenService.wipeTokenAccount(token, msg.sender, amount);
    if (responseCode != HederaResponseCodes.SUCCESS) {
        revert("burn failed");
    }
    emit TokenControllerMessage("BURN", msg.sender, amount, "Burn (from user) complete");
}
```

Key points:
- The contract holds the Wipe Key, but `burn()` uses `msg.sender` -- callers can only burn tokens **they own**
- The owner cannot burn other people's tokens (no admin backdoor)
- Supply is deflationary -- total supply decreases permanently with each burn
- No additional minting is possible (no Supply Key)

**Best for:** Deflationary tokens, token-gated ecosystems where users earn-and-burn, gamified economies.

### Fork and Customize Guide

The no-keys pattern is intentionally restrictive. Fork the contract and apply the modifications below to build your own variant. Each modification alters the trust model -- understand the trade-offs before deploying.

#### Adding capabilities (add a key + add a function)

To add a capability, you need to: (1) add the appropriate HTS key to the `tokenKeys` array in your token creation function, and (2) add a function that uses the corresponding HTS precompile call.

| Capability | Key to Add | Function to Add | Trust Model Impact |
|------------|-----------|----------------|-------------------|
| **Burn (user self-burn)** | `WIPE_KEY_TYPE` (8) via `CONTRACT_ID_KEY` | Public `burn()` using `wipeTokenAccount(token, msg.sender, amount)` | Deflationary -- supply can only decrease. Safe: users can only burn their own tokens |
| **Burn (owner burn from treasury)** | `SUPPLY_KEY_TYPE` (16) via `CONTRACT_ID_KEY` | `onlyOwner burnFromTreasury()` using `burnToken(token, amount, serials)` | Owner controls supply reduction from treasury |
| **Mint additional supply** | `SUPPLY_KEY_TYPE` (16) via `CONTRACT_ID_KEY` | `onlyOwner mintAdditional()` using `mintToken(token, amount, metadata)` | **Breaks fixed supply** -- owner can inflate the token |
| **Pause/unpause** | `PAUSE_KEY_TYPE` (64) via `CONTRACT_ID_KEY` | `onlyOwner pause()`/`unpause()` using `pauseToken(token)`/`unpauseToken(token)` | **Centralized control** -- all transfers can be halted |
| **Freeze accounts** | `FREEZE_KEY_TYPE` (4) via `CONTRACT_ID_KEY` | `onlyOwner freeze()`/`unfreeze()` using `freezeToken(token, account)` | **Centralized compliance** -- individual accounts can be frozen |
| **KYC gating** | `KYC_KEY_TYPE` (2) via `CONTRACT_ID_KEY` | `onlyOwner grantKyc()`/`revokeKyc()` | **Centralized compliance** -- accounts require approval to transact |
| **Custom fees** | `FEE_SCHEDULE_KEY_TYPE` (32) via `CONTRACT_ID_KEY` | `onlyOwner updateFees()` using fee helpers from `FeeHelper.sol` | Owner controls fee extraction on every transfer |

**Example: Adding burn + mint to the no-keys contract:**

```solidity
// Change createTokenWithNoKeys to createTokenWithKeys
IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
keys[0] = createSingleKey(WIPE_KEY_TYPE, CONTRACT_ID_KEY, address(this));   // burn
keys[1] = createSingleKey(SUPPLY_KEY_TYPE, CONTRACT_ID_KEY, address(this)); // mint
token.tokenKeys = keys;
```

#### Removing capabilities (remove functions you don't need)

If you fork this project and don't need certain features, simply remove the corresponding functions. This reduces the contract's attack surface and bytecode size.

| To Remove | Functions to Delete | Effect |
|-----------|-------------------|--------|
| Allowance whitelist | `_allowanceWL` state variable, `addAllowanceWhitelist()`, `removeAllowanceWhitelist()`, `getAllowanceWhitelist()`, `isAddressWL()`, and the `require(_allowanceWL.contains(...))` in `approveAllowance` | Anyone can receive allowances -- simpler but less controlled |
| ERC-20 transfer | `transfer()` function and `IERC20` import | Only HTS transfer path remains -- slightly simpler |
| HTS transfer | `transferHTS()` function | Only ERC-20 transfer path remains |
| Allowance system entirely | `approveAllowance()`, `checkAllowance()`, whitelist functions | Treasury can only distribute via direct transfer |
| HBAR management | `transferHbar()`, `receive()`, `fallback()` | Contract cannot receive or send HBAR (but still needs HBAR for auto-renewal) |

#### Changing ownership model

| Pattern | How | When to Use |
|---------|-----|-------------|
| **Single owner** (default) | `Ownable` from OpenZeppelin | Simple projects, single operator |
| **Two-step ownership** | Replace `Ownable` with `Ownable2Step` (OZ 4.8+) | Prevent accidental ownership transfer |
| **Multi-sig at Hedera level** | Use `--multisig` flag with scripts + `@lazysuperheroes/hedera-multisig` | Shared operational control, no contract changes needed |
| **Multi-sig at contract level** | Replace `Ownable` with a multi-sig modifier or Gnosis Safe | On-chain shared control, requires contract modification |
| **Renounce ownership** | Call `renounceOwnership()` | Permanently locks all owner functions -- **irreversible** |

### HTS Key Types Reference

The Hedera Token Service defines 7 key types. Each key grants a specific power over the token. Keys can be assigned to accounts, contracts, or multi-sig thresholds.

| Key Type | Bit Value | Power | Assigned via |
|----------|-----------|-------|-------------|
| Admin | 1 | Update token properties, delete token | `ADMIN_KEY_TYPE` |
| KYC | 2 | Grant/revoke KYC on accounts | `KYC_KEY_TYPE` |
| Freeze | 4 | Freeze/unfreeze accounts | `FREEZE_KEY_TYPE` |
| Wipe | 8 | Wipe token balance from accounts | `WIPE_KEY_TYPE` |
| Supply | 16 | Mint new tokens, burn from treasury | `SUPPLY_KEY_TYPE` |
| Fee Schedule | 32 | Modify custom fees | `FEE_SCHEDULE_KEY_TYPE` |
| Pause | 64 | Pause/unpause all token operations | `PAUSE_KEY_TYPE` |

When assigning keys to the contract itself (recommended), use `KeyHelper.CONTRACT_ID_KEY` with `address(this)`. This ensures only the smart contract can exercise the key -- not any external account.

The HTS helper contracts (`HederaTokenService.sol`, `KeyHelper.sol`, `ExpiryHelper.sol`, `FeeHelper.sol`, `IHederaTokenService.sol`, `HederaResponseCodes.sol`) are included in `contracts/` and provide all the building blocks for any combination of keys and token operations.

### Extension Ideas

The core value of the smart contract treasury pattern is that **all token operations are governed by auditable on-chain logic**, not by opaque key-holders who can act unilaterally. Every capability is wrapped in a function with clear access control and event emission. Here are extension ideas that build on this principle:

**Burn-and-Remint (Recycling Supply)**
Combine a Wipe Key + Supply Key on the same contract. When a user burns tokens, the contract can automatically remint the same amount back into the treasury. Total supply stays constant, but burned tokens return to the pool for redistribution. Useful for token-gated access systems where tokens are "spent" on actions but recycled for future use.

**Capped Minting with Cooldown**
Add a Supply Key but enforce minting rules in the contract: a maximum mint amount per call, a cooldown period between mints (using `block.timestamp`), and a hard lifetime cap. The contract makes the rules transparent and immutable -- unlike a raw Supply Key where the holder could mint unlimited tokens at any time.

**Burn-to-Earn / Deflationary Rewards**
Combine the burn variant with an allowance system: users burn a specific amount of Token A, and the contract releases Token B (or HBAR) from the treasury. The exchange rate and rules are encoded in the contract. Creates verifiable deflationary tokenomics.

**Vote-Gated Operations**
Add a simple voting mechanism before sensitive operations. Instead of `onlyOwner`, require N-of-M whitelisted addresses to call a `vote()` function before the operation can execute. This brings on-chain governance to token operations without needing an external DAO framework.

**Time-Locked Treasury Release**
Add a vesting schedule to `transferHTS`: tokens can only be released from the treasury after specific timestamps or at a maximum rate per period. The contract enforces the schedule transparently. Useful for team token allocations, investor vesting, or gradual community distribution.

**Fee-on-Transfer (Redistribution)**
Use the Fee Schedule Key to attach a fractional fee to every transfer, routed back to the contract treasury or to a community wallet. The fee rate is set at token creation and governed by the contract. Combined with burn, this creates a deflationary-with-redistribution model.

**Multi-Token Treasury**
Extend the contract to create and manage multiple fungible tokens from a single treasury. Add a mapping of token addresses with per-token configuration (whitelist, allowances, burn rules). Useful for projects that issue multiple token types (utility + governance, seasonal tokens, etc.).

**PRNG-Based Distribution**
Use Hedera's PRNG precompile (`0x169`) to add verifiable randomness to token distribution. The contract could randomly select recipients from the whitelist for airdrops, or randomize reward amounts within bounds. On-chain randomness ensures fairness is provable.

### Roadmap

Future enhancements under consideration:

- **Burn-and-remint variant** -- contract-governed token recycling with configurable rules
- **Capped minting with on-chain rate limiting** -- Supply Key with transparent, contract-enforced constraints
- **Time-locked vesting schedules** -- treasury release governed by on-chain timestamps
- **Multi-token treasury support** -- manage multiple FTs from a single contract
- **Mirror node event indexer** -- enhanced monitoring and analytics tooling
- **TypeScript SDK wrapper** -- typed programmatic API for consuming projects

---

## Security Model

### What "no keys" means

When a token is created on Hedera, it can be assigned various keys that grant specific powers. This contract creates tokens with **none of these keys set**:

| Key | Power | Status in This Contract |
|-----|-------|------------------------|
| Admin Key | Update token properties, delete token | **Not set** |
| Supply Key | Mint new tokens, burn existing tokens | **Not set** |
| Freeze Key | Freeze/unfreeze accounts from transacting | **Not set** |
| Wipe Key | Wipe token balance from an account | **Not set** |
| KYC Key | Grant/revoke KYC status for accounts | **Not set** |
| Pause Key | Pause/unpause all token operations | **Not set** |
| Fee Schedule Key | Update custom fee schedule | **Not set** |

Once a token is created without a key, that key **cannot be added later**. This is enforced by the Hedera network itself, not by this contract.

### What the contract owner CAN do

- Transfer tokens from the treasury to associated accounts
- Manage the allowance whitelist (add/remove addresses)
- Set spending allowances for whitelisted addresses
- Withdraw HBAR from the contract
- Receive HBAR into the contract

### What NO ONE can do (including the owner)

- Mint additional tokens beyond the initial supply
- Burn or destroy any tokens
- Freeze or unfreeze any account
- Wipe tokens from any account
- Change the token name, symbol, memo, or any metadata
- Add keys to the token after creation
- Pause or unpause token transfers
- Modify the fee schedule

### Auto-Renewal and HBAR Funding

Both the contract and the token have auto-renewal periods (default: 90 days / 7,776,000 seconds). The contract must hold sufficient HBAR to pay for auto-renewal. If the contract runs out of HBAR, the token and contract may expire. Use `transferHbar` (sending HBAR to the contract via `receive()`) and the `npm run transferHbar` script to manage the contract's HBAR balance.

---

## Testing

Tests run against the **Hedera testnet** (not a local emulator) and perform real network transactions. This means:

- Tests require valid testnet credentials in `.env`
- Tests cost real testnet HBAR (small amounts, reclaimed in cleanup)
- Tests have extended timeouts to accommodate network latency
- Each test run deploys a fresh contract and mints a new token

### Running Tests

```bash
npm run test
```

### What Is Tested

The test suite (`test/FungibleTokenCreator.test.js`) covers:

- **Deployment**: Contract deploys successfully
- **Access control**: Only the owner can mint tokens
- **Token creation**: Minting a no-keys fungible token with correct supply
- **Balance verification**: Contract treasury holds the full initial supply
- **Token association**: Associating the token with operator, Alice, and Bob accounts
- **ERC-20 transfer**: Transferring tokens via the `transfer` function
- **HTS transfer**: Transferring tokens via the `transferHTS` function
- **Whitelist management**: Adding/removing addresses, verifying whitelist state
- **Allowance enforcement**: Cannot set allowance for non-whitelisted addresses
- **Allowance workflow**: Approve allowance, third-party spends from treasury, allowance depletes correctly
- **HBAR operations**: Sending HBAR to the contract, withdrawing HBAR from the contract
- **Non-owner restrictions**: Verifying Alice cannot call owner-only functions (transfer, mint, burn, whitelist, HBAR withdrawal)
- **Non-owner read access**: Verifying Alice can call view functions (whitelist queries, allowance checks)
- **Cleanup**: Recovering HBAR from test accounts and the contract

---

## Project Structure

```
hedera-ft-sc/
  contracts/
    FungibleTokenCreator.sol    # Main contract (no-keys treasury pattern)
    HederaTokenService.sol      # HTS precompile wrapper
    IHederaTokenService.sol     # HTS interface definitions
    HederaResponseCodes.sol     # Hedera response code constants
    ExpiryHelper.sol            # Token expiry/auto-renew helpers
    KeyHelper.sol               # Token key construction helpers
    FeeHelper.sol               # Custom fee schedule helpers
  scripts/
    deploy.js                   # Deploy the contract
    mintToken.js                # Mint a no-keys fungible token
    sendFungible.js             # Transfer tokens from treasury
    setAllowance.js             # Set spending allowance
    adjustWL.js                 # Manage allowance whitelist
    interact.js                 # Query contract state
    associateToken.js           # Associate token with account
    checkAllowance.js           # Check allowance amount
    transferHbar.js             # Withdraw HBAR from contract
    getContractLogs.js          # Fetch event logs from mirror node
    getContractInfo.js          # Get contract info (balance, expiry)
    decodeSmartContractError.js # Decode contract errors
  utils/
    clientFactory.js            # Hedera client initialization
    abiLoader.js                # ABI loading with caching
    solidityHelpers.js          # Contract execution/query/deploy
    hederaHelpers.js            # HTS account and balance helpers
    hederaMirrorHelpers.js      # Mirror node query helpers (free)
    scriptHelpers.js            # CLI script utilities
    multisigHelpers.js          # Multi-sig workflow integration
    nodeHelpers.js              # Command line argument parsing
    constants.js                # Named constants (gas, delays, etc.)
  test/
    FungibleTokenCreator.test.js  # Integration tests (testnet)
  index.js                      # Package entry point (all exports)
  hardhat.config.js             # Hardhat configuration (Solidity 0.8.18)
```

---

## Credits

Built by the [Lazy Super Heroes](https://github.com/lazysuperheroes) team.

- **GitHub:** [github.com/lazysuperheroes](https://github.com/lazysuperheroes)
- **Repository:** [github.com/lazysuperheroes/hedera-ft-sc](https://github.com/lazysuperheroes/hedera-ft-sc)

### Key Dependencies

- [Hedera JavaScript SDK](https://github.com/hashgraph/hedera-sdk-js) (`@hashgraph/sdk` 2.79.0) -- Hedera network interaction
- [ethers.js](https://docs.ethers.org/v6/) (v6.16.0) -- ABI encoding/decoding
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/4.x/) (v4.9.6) -- `Ownable`, `EnumerableSet`, `Address`, `SafeCast`
- [Hardhat](https://hardhat.org/) -- Compilation and testing framework
- [@lazysuperheroes/hedera-multisig](https://github.com/lazysuperheroes) -- Optional multi-signature workflow support
