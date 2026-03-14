/**
 * Common Script Helper Functions
 * Standardizes patterns used across interaction scripts
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const readlineSync = require('readline-sync');
const {
	parseMultisigArgs,
	isMultisigEnabled,
	filterMultisigArgs,
	contractExecuteWithMultisig,
} = require('./multisigHelpers');

/**
 * Checks if a contract execution result was successful
 * @param {Array} result - Result from contractExecuteFunction
 * @returns {boolean} True if successful
 */
function isSuccess(result) {
	return result[0]?.status?.toString() === 'SUCCESS';
}

/**
 * Gets the transaction ID from a contract execution result
 * @param {Array} result - Result from contractExecuteFunction
 * @returns {string|null} Transaction ID or null
 */
function getTransactionId(result) {
	return result[2]?.transactionId?.toString() ?? null;
}

/**
 * Logs execution result and returns success status
 * @param {Array} result - Result from contractExecuteFunction
 * @param {string} operation - Description of the operation
 * @returns {boolean} True if successful
 */
function logResult(result, operation) {
	if (isSuccess(result)) {
		const txId = getTransactionId(result);
		console.log(`${operation} successful.${txId ? ` Transaction ID: ${txId}` : ''}`);
		return true;
	}
	else {
		console.log(`ERROR: ${operation} failed:`, result[0]?.status ?? result);
		return false;
	}
}

/**
 * Prompts user for Y/N confirmation
 * @param {string} message - The prompt message
 * @returns {boolean} True if user confirmed
 */
function confirmAction(message) {
	return readlineSync.keyInYNStrict(message);
}

/**
 * Prompts user and exits if not confirmed
 * @param {string} message - The prompt message
 * @param {string} abortMessage - Message to show on abort (default: 'User Aborted')
 */
function confirmOrExit(message, abortMessage = 'User Aborted') {
	if (!confirmAction(message)) {
		console.log(abortMessage);
		process.exit(0);
	}
}

/**
 * Prints standard script header with environment info
 * Automatically shows multisig status if --multisig flag is present
 * @param {Object} options - Header options
 * @param {string} options.scriptName - Name of the script
 * @param {string} options.env - Environment (TEST, MAIN, etc.)
 * @param {string} options.operatorId - Operator account ID
 * @param {string} options.contractId - Contract being interacted with
 * @param {Object} options.additionalInfo - Additional key-value pairs to display
 */
function printHeader(options) {
	const { scriptName, env, operatorId, contractId, additionalInfo = {} } = options;

	if (scriptName) console.log(`\n-** ${scriptName.toUpperCase()} **`);
	if (env) console.log(`\n-Using ENVIRONMENT: ${env}`);
	if (operatorId) console.log(`\n-Using Operator: ${operatorId}`);
	if (contractId) console.log(`\n-Using Contract: ${contractId}`);

	// Show multisig status if enabled
	if (isMultisigEnabled()) {
		const msOptions = parseMultisigArgs();
		console.log(`\n-MULTISIG MODE: ${msOptions.threshold}-of-${msOptions.signerLabels.length} (${msOptions.signerLabels.join(', ')})`);
	}

	for (const [key, value] of Object.entries(additionalInfo)) {
		console.log(`\n-${key}: ${value}`);
	}
}

/**
 * Prints usage information and exits
 * @param {string} usage - Usage string
 * @param {string[]} details - Additional detail lines
 */
function printUsageAndExit(usage, details = []) {
	console.log(`Usage: ${usage}`);
	for (const detail of details) {
		console.log(`       ${detail}`);
	}
	process.exit(0);
}

/**
 * Parses command line arguments with help flag check
 * Automatically filters out multisig flags (--multisig, --threshold, --signers, --workflow)
 * @param {number} expectedCount - Expected number of arguments
 * @param {string} usage - Usage string for help
 * @param {string[]} details - Additional detail lines for help
 * @returns {string[]} The arguments array (without multisig flags)
 */
function parseArgs(expectedCount, usage, details = []) {
	const { getArgFlag } = require('./nodeHelpers');

	// Filter out multisig-related args before counting
	const filteredArgv = filterMultisigArgs(process.argv);
	const args = filteredArgv.slice(2);

	// Add multisig usage hint to details
	const multisigHint = '       [--multisig [--threshold N] [--signers "Label1,Label2"]]';

	if (args.length !== expectedCount || getArgFlag('h')) {
		printUsageAndExit(usage, [...details, '', 'Multisig Options:', multisigHint]);
	}

	return args;
}

/**
 * Formats a token amount with decimals for display
 * @param {number|bigint} amount - Raw token amount
 * @param {number} decimals - Number of decimals
 * @param {string} symbol - Token symbol (optional)
 * @returns {string} Formatted amount
 */
function formatTokenAmount(amount, decimals, symbol = '') {
	const value = Number(amount) / Math.pow(10, decimals);
	return symbol ? `${value} ${symbol}` : value.toString();
}

/**
 * Parses a human-readable token amount to smallest unit
 * @param {string|number} amount - Human-readable amount
 * @param {number} decimals - Number of decimals
 * @returns {number} Amount in smallest units
 */
function parseTokenAmount(amount, decimals) {
	return Math.floor(Number(amount) * Math.pow(10, decimals));
}

/**
 * Standard main function wrapper with error handling
 * @param {Function} mainFn - The async main function to run
 */
function runScript(mainFn) {
	mainFn()
		.then(() => {
			process.exit(0);
		})
		.catch(error => {
			console.error(error);
			process.exit(1);
		});
}

/**
 * Parses comma-separated string to array
 * @param {string} str - Comma-separated string
 * @returns {string[]} Array of trimmed strings
 */
function parseCommaList(str) {
	return str.split(',').map(s => s.trim());
}

/**
 * Get multisig options from command line if --multisig flag is present
 * Returns null if not in multisig mode
 * @returns {Object|null} Multisig options or null
 */
function getMultisigOptions() {
	return parseMultisigArgs();
}

/**
 * Updates a value in the .env file
 * @param {string} key - The env var key to update
 * @param {string} value - The new value
 * @param {string} envPath - Path to .env file (default: ./.env)
 */
function updateEnvFile(key, value, envPath = './.env') {
	const fs = require('fs');

	if (!fs.existsSync(envPath)) {
		console.log(`WARNING: .env file not found at ${envPath}, cannot auto-update ${key}`);
		return;
	}

	let content = fs.readFileSync(envPath, 'utf8');
	const regex = new RegExp(`^${key}=.*$`, 'm');

	if (regex.test(content)) {
		content = content.replace(regex, `${key}=${value}`);
	}
	else {
		content += `\n${key}=${value}`;
	}

	fs.writeFileSync(envPath, content, 'utf8');
	console.log(`Updated .env: ${key}=${value}`);
}

module.exports = {
	isSuccess,
	getTransactionId,
	logResult,
	confirmAction,
	confirmOrExit,
	printHeader,
	printUsageAndExit,
	parseArgs,
	formatTokenAmount,
	parseTokenAmount,
	runScript,
	parseCommaList,
	updateEnvFile,
	// Multisig helpers (re-exported for convenience)
	getMultisigOptions,
	isMultisigEnabled,
	contractExecuteWithMultisig,
};
