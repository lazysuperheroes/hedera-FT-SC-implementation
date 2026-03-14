/**
 * @lazysuperheroes/hedera-ft-sc
 *
 * Hedera Fungible Token Smart Contract Treasury Implementation
 * Creates and manages fungible tokens via a Smart Contract treasury with no keys
 * (immutable, transparent, prevents rug pulls)
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 * @license GPL-3.0
 */

// Client and configuration
const { createHederaClient, getContractConfig } = require('./utils/clientFactory');

// ABI loading and caching
const { loadAbi, loadInterface, loadBytecode, loadContract } = require('./utils/abiLoader');

// Contract interaction
const {
	contractExecuteFunction,
	contractExecuteQuery,
	contractDeployFunction,
	readOnlyEVMFromMirrorNode,
	parseError,
	parseErrorTransactionId,
} = require('./utils/solidityHelpers');

// Mirror node queries (free)
const {
	getBaseURL,
	checkMirrorAllowance,
	checkMirrorBalance,
	getTokenDetails,
	getContractInfo,
	getContractLogs,
	checkLastMirrorEvent,
} = require('./utils/hederaMirrorHelpers');

// HTS helpers
const {
	accountCreator,
	associateTokenToAccount,
	hbarTransfer,
	getAccountBalance,
	getContractBalance,
} = require('./utils/hederaHelpers');

// Script helpers (for CLI consumers)
const {
	isSuccess,
	logResult,
	confirmOrExit,
	printHeader,
	parseArgs,
	formatTokenAmount,
	parseTokenAmount,
	runScript,
	updateEnvFile,
	getMultisigOptions,
	contractExecuteWithMultisig,
} = require('./utils/scriptHelpers');

// Constants
const { GAS, DELAYS, PRECOMPILES, TOKEN_DEFAULTS } = require('./utils/constants');

module.exports = {
	// Client
	createHederaClient,
	getContractConfig,

	// ABI
	loadAbi,
	loadInterface,
	loadBytecode,
	loadContract,

	// Contract execution
	contractExecuteFunction,
	contractExecuteQuery,
	contractDeployFunction,
	readOnlyEVMFromMirrorNode,
	parseError,
	parseErrorTransactionId,

	// Mirror node
	getBaseURL,
	checkMirrorAllowance,
	checkMirrorBalance,
	getTokenDetails,
	getContractInfo,
	getContractLogs,
	checkLastMirrorEvent,

	// HTS helpers
	accountCreator,
	associateTokenToAccount,
	hbarTransfer,
	getAccountBalance,
	getContractBalance,

	// Script helpers
	isSuccess,
	logResult,
	confirmOrExit,
	printHeader,
	parseArgs,
	formatTokenAmount,
	parseTokenAmount,
	runScript,
	updateEnvFile,
	getMultisigOptions,
	contractExecuteWithMultisig,

	// Constants
	GAS,
	DELAYS,
	PRECOMPILES,
	TOKEN_DEFAULTS,
};
