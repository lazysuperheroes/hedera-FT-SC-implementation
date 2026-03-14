/**
 * Centralized Hedera Client Factory
 * Eliminates duplicated client initialization code across all scripts
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const {
	Client,
	AccountId,
	PrivateKey,
	TokenId,
	ContractId,
} = require('@hashgraph/sdk');
require('dotenv').config();

/**
 * Creates and configures a Hedera client based on environment settings
 * @param {Object} options - Configuration options
 * @param {boolean} options.requireOperator - If true, exits on missing operator credentials (default: true)
 * @param {string[]} options.requireEnvVars - Additional env vars that must be present
 * @returns {{
 *   client: Client,
 *   operatorId: AccountId,
 *   operatorKey: PrivateKey,
 *   env: string
 * }}
 */
function createHederaClient(options = {}) {
	const {
		requireOperator = true,
		requireEnvVars = [],
	} = options;

	// Load environment
	const env = process.env.ENVIRONMENT ?? null;

	// Load operator credentials
	let operatorKey = null;
	let operatorId = null;

	try {
		if (process.env.PRIVATE_KEY) {
			operatorKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY);
		}
		if (process.env.ACCOUNT_ID) {
			operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
		}
	}
	catch (err) {
		console.log('ERROR: Failed to parse PRIVATE_KEY or ACCOUNT_ID from .env file');
		console.log(err.message);
	}

	// Validate required operator credentials
	if (requireOperator && (!operatorKey || !operatorId)) {
		console.log('ERROR: Must specify PRIVATE_KEY & ACCOUNT_ID in the .env file');
		process.exit(1);
	}

	// Validate additional required env vars
	for (const varName of requireEnvVars) {
		if (!process.env[varName]) {
			console.log(`ERROR: Must specify ${varName} in the .env file`);
			process.exit(1);
		}
	}

	// Validate environment
	if (!env) {
		console.log('ERROR: Must specify ENVIRONMENT (TEST, MAIN, PREVIEW, or LOCAL) in .env file');
		process.exit(1);
	}

	// Create client based on environment
	let client;
	const envUpper = env.toUpperCase();

	switch (envUpper) {
	case 'TEST':
		client = Client.forTestnet();
		console.log('Using *TESTNET*');
		break;
	case 'MAIN':
		client = Client.forMainnet();
		console.log('Using *MAINNET*');
		break;
	case 'PREVIEW':
		client = Client.forPreviewnet();
		console.log('Using *PREVIEWNET*');
		break;
	case 'LOCAL':
		client = Client.forNetwork({ '127.0.0.1:50211': new AccountId(3) })
			.setMirrorNetwork('127.0.0.1:5600');
		console.log('Using *LOCAL*');
		break;
	default:
		console.log('ERROR: ENVIRONMENT must be TEST, MAIN, PREVIEW, or LOCAL');
		process.exit(1);
	}

	// Set operator if available
	if (operatorKey && operatorId) {
		client.setOperator(operatorId, operatorKey);
	}

	return {
		client,
		operatorId,
		operatorKey,
		env,
	};
}

/**
 * Gets common contract/token configuration from environment
 * @returns {{
 *   contractId: ContractId | null,
 *   tokenId: TokenId | null,
 *   tokenDecimals: number,
 *   contractName: string
 * }}
 */
function getContractConfig() {
	let contractId = null;
	let tokenId = null;

	try {
		if (process.env.CONTRACT_ID) {
			contractId = ContractId.fromString(process.env.CONTRACT_ID);
		}
	}
	catch (err) {
		// Optional
	}

	try {
		if (process.env.TOKEN_ID) {
			tokenId = TokenId.fromString(process.env.TOKEN_ID);
		}
	}
	catch (err) {
		// Optional
	}

	return {
		contractId,
		tokenId,
		tokenDecimals: parseInt(process.env.TOKEN_DECIMALS ?? '0', 10),
		contractName: process.env.CONTRACT_NAME ?? 'FungibleTokenCreator',
	};
}

module.exports = {
	createHederaClient,
	getContractConfig,
};
