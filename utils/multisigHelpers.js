/**
 * Multisig integration helpers for admin operations
 * Uses @lazysuperheroes/hedera-multisig for M-of-N signature collection
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const { ContractExecuteTransaction, Hbar } = require('@hashgraph/sdk');

/**
 * Build a frozen ContractExecuteTransaction ready for multisig signing
 * @param {ContractId} contractId - The contract to call
 * @param {ethers.Interface} iface - The contract interface (ABI)
 * @param {Client} client - Hedera client (used to freeze transaction)
 * @param {number} gasLim - Gas limit for the transaction
 * @param {string} fcnName - Function name to call
 * @param {Array} params - Function parameters
 * @param {number} amountHbar - HBAR amount to send (default 0)
 * @returns {Promise<ContractExecuteTransaction>} Frozen transaction ready for signing
 */
async function buildContractExecuteTransaction(contractId, iface, client, gasLim, fcnName, params = [], amountHbar = 0) {
	if (!gasLim || isNaN(gasLim)) {
		gasLim = 200_000;
	}

	const encodedCommand = iface.encodeFunctionData(fcnName, params);

	const tx = new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(gasLim)
		.setFunctionParameters(Buffer.from(encodedCommand.slice(2), 'hex'))
		.setPayableAmount(new Hbar(amountHbar));

	// Freeze the transaction so it can be signed
	return tx.freezeWith(client);
}

/**
 * Execute a transaction through the multisig workflow
 * @param {Transaction} frozenTransaction - A frozen Hedera transaction
 * @param {Client} client - Hedera client for execution
 * @param {Object} options - Multisig options
 * @param {number} options.threshold - Number of signatures required (default 2)
 * @param {string[]} options.signerLabels - Labels for each signer (default ['Signer 1', 'Signer 2'])
 * @param {string} options.workflow - Workflow type: 'interactive' | 'offline' | 'web' (default 'interactive')
 * @returns {Promise<Object>} Execution result with transactionId and receipt
 */
async function executeWithMultisig(frozenTransaction, client, options = {}) {
	const { WorkflowOrchestrator, PromptKeyProvider } = require('@lazysuperheroes/hedera-multisig');

	const {
		threshold = 2,
		signerLabels = ['Signer 1', 'Signer 2'],
		workflow = 'interactive',
	} = options;

	const orchestrator = new WorkflowOrchestrator(client);

	// Build key providers for each signer
	const keyProviders = signerLabels.map(label => new PromptKeyProvider({ label }));

	console.log('\n=== MULTISIG SIGNING REQUIRED ===');
	console.log(`Threshold: ${threshold} of ${signerLabels.length} signatures required`);
	console.log(`Signers: ${signerLabels.join(', ')}`);
	console.log(`Workflow: ${workflow}`);
	console.log('================================\n');

	const result = await orchestrator.execute(frozenTransaction, {
		workflow,
		keyProviders,
		threshold,
		signerLabels,
	});

	return result;
}

/**
 * Execute a contract function with optional multisig support
 * Drop-in replacement for contractExecuteFunction when multisig is needed
 * @param {ContractId} contractId - The contract to call
 * @param {ethers.Interface} iface - The contract interface
 * @param {Client} client - Hedera client
 * @param {number} gasLim - Gas limit
 * @param {string} fcnName - Function name
 * @param {Array} params - Function parameters
 * @param {Object} multisigOptions - Multisig configuration (if provided, uses multisig)
 * @param {number} amountHbar - HBAR amount to send
 * @returns {Promise<[TransactionReceipt, any, TransactionRecord]>} Same return format as contractExecuteFunction
 */
async function contractExecuteWithMultisig(contractId, iface, client, gasLim, fcnName, params = [], multisigOptions = null, amountHbar = 0) {
	// If no multisig options, fall back to direct execution
	if (!multisigOptions) {
		const { contractExecuteFunction } = require('./solidityHelpers');
		return contractExecuteFunction(contractId, iface, client, gasLim, fcnName, params, amountHbar);
	}

	// Build the frozen transaction
	const frozenTx = await buildContractExecuteTransaction(
		contractId, iface, client, gasLim, fcnName, params, amountHbar,
	);

	// Execute through multisig workflow
	const result = await executeWithMultisig(frozenTx, client, multisigOptions);

	// Format result to match contractExecuteFunction return signature
	const receipt = result.receipt || { status: result.status };
	const record = result.record || null;

	// Try to decode function result if available
	let contractResults;
	if (record?.contractFunctionResult?.bytes) {
		try {
			contractResults = iface.decodeFunctionResult(fcnName, record.contractFunctionResult.bytes);
		}
		catch (e) {
			console.log('Could not decode function result:', e.message);
		}
	}

	return [receipt, contractResults, record];
}

/**
 * Parse multisig options from command line arguments
 * Looks for --multisig flag and optional --threshold and --signers flags
 * @param {string[]} args - Command line arguments (process.argv)
 * @returns {Object|null} Multisig options or null if not using multisig
 */
function parseMultisigArgs(args = process.argv) {
	const multisigIndex = args.indexOf('--multisig');
	if (multisigIndex === -1) {
		return null;
	}

	// Default options
	const options = {
		threshold: 2,
		signerLabels: ['Signer 1', 'Signer 2'],
		workflow: 'interactive',
	};

	// Parse --threshold
	const thresholdIndex = args.indexOf('--threshold');
	if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
		options.threshold = parseInt(args[thresholdIndex + 1], 10);
	}

	// Parse --signers (comma-separated labels)
	const signersIndex = args.indexOf('--signers');
	if (signersIndex !== -1 && args[signersIndex + 1]) {
		options.signerLabels = args[signersIndex + 1].split(',').map(s => s.trim());
	}

	// Parse --workflow
	const workflowIndex = args.indexOf('--workflow');
	if (workflowIndex !== -1 && args[workflowIndex + 1]) {
		options.workflow = args[workflowIndex + 1];
	}

	// Validate threshold doesn't exceed signers
	if (options.threshold > options.signerLabels.length) {
		console.warn(`Warning: threshold (${options.threshold}) exceeds number of signers (${options.signerLabels.length})`);
		options.threshold = options.signerLabels.length;
	}

	return options;
}

/**
 * Check if multisig mode is enabled via command line
 * @returns {boolean}
 */
function isMultisigEnabled() {
	return process.argv.includes('--multisig');
}

/**
 * Filter out multisig-related arguments from argv
 * Useful for scripts that parse their own arguments
 * @param {string[]} args - Command line arguments
 * @returns {string[]} Arguments without multisig flags
 */
function filterMultisigArgs(args = process.argv) {
	const multisigFlags = ['--multisig', '--threshold', '--signers', '--workflow'];
	const result = [];

	for (let i = 0; i < args.length; i++) {
		if (multisigFlags.includes(args[i])) {
			// Skip flag and its value (if applicable)
			if (args[i] !== '--multisig' && args[i + 1] && !args[i + 1].startsWith('--')) {
				// Skip the value too
				i++;
			}
			continue;
		}
		result.push(args[i]);
	}

	return result;
}

module.exports = {
	buildContractExecuteTransaction,
	executeWithMultisig,
	contractExecuteWithMultisig,
	parseMultisigArgs,
	isMultisigEnabled,
	filterMultisigArgs,
};
