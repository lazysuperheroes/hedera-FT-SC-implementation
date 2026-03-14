/**
 * Named Constants
 * Replaces magic numbers with meaningful names across all scripts
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */

/**
 * Gas limits for common operations
 * Based on observed usage patterns on Hedera
 */
const GAS = {
	// Standard operations
	DEFAULT: 100_000,
	STANDARD: 200_000,

	// Contract queries
	QUERY: 100_000,

	// Token operations
	TOKEN_CREATE: 800_000,
	TOKEN_TRANSFER: 800_000,
	TOKEN_ASSOCIATE: 950_000,

	// Allowance operations
	ALLOWANCE_APPROVE: 800_000,

	// HBAR operations
	HBAR_TRANSFER: 200_000,

	// Deployment
	CONTRACT_DEPLOY: 4_200_000,
};

/**
 * Mirror node polling/delay times (milliseconds)
 */
const DELAYS = {
	// Standard mirror node propagation delay
	MIRROR_NODE: 5000,

	// Short polling interval
	SHORT_POLL: 1000,

	// Long polling interval
	LONG_POLL: 10000,
};

/**
 * Hedera precompile addresses
 */
const PRECOMPILES = {
	// HTS System Contract
	HTS: '0x0000000000000000000000000000000000000167',

	// PRNG System Contract
	PRNG: '0x0000000000000000000000000000000000000169',

	// Exchange Rate System Contract
	EXCHANGE_RATE: '0x0000000000000000000000000000000000000168',
};

/**
 * Token creation defaults
 */
const TOKEN_DEFAULTS = {
	// HBAR to send with token creation transaction
	CREATE_PAYMENT: 50,

	// Auto-renew period in seconds (90 days)
	AUTO_RENEW_PERIOD: 7_776_000,
};

module.exports = {
	GAS,
	DELAYS,
	PRECOMPILES,
	TOKEN_DEFAULTS,
};
