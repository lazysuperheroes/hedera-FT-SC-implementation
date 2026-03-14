const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, runScript } = require('../utils/scriptHelpers');
const { parseError } = require('../utils/solidityHelpers');
const { getBaseURL } = require('../utils/hederaMirrorHelpers');
const axios = require('axios');

const main = async () => {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes('-h')) {
		console.log('Usage:');
		console.log('  Decode raw error data:');
		console.log('    node decodeSmartContractError.js <error_hex_data>');
		console.log('');
		console.log('  Fetch latest error from mirror node:');
		console.log('    node decodeSmartContractError.js mirror');
		console.log('');
		console.log('  Fetch last N errors from mirror node:');
		console.log('    node decodeSmartContractError.js mirror <depth>');
		console.log('');
		console.log('  Requires CONTRACT_ID and ENVIRONMENT in .env file for mirror queries.');
		process.exit(0);
	}

	// Mode 1: Raw error data passed as argument
	if (args.length === 1 && args[0] !== 'mirror') {
		const { contractName } = getContractConfig();
		const iface = loadInterface(contractName);

		console.log('\n- Decoding error data...');
		const result = parseError(iface, args[0]);
		console.log('  Result:', result);
		return;
	}

	// Mode 2: Fetch from mirror node
	const { env } = createHederaClient({ requireOperator: false });
	const { contractId, contractName } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file for mirror queries');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Decode Smart Contract Error',
		env,
		contractId: contractId.toString(),
	});

	const iface = loadInterface(contractName);
	const baseUrl = getBaseURL(env);
	const depth = args.length >= 2 ? parseInt(args[1], 10) : 1;

	for (let d = 1; d <= depth; d++) {
		console.log(`\n- Fetching error (depth ${d})...`);
		const url = `${baseUrl}/api/v1/contracts/${contractId.toString()}/results?order=desc&limit=${d}`;

		try {
			const response = await axios.get(url);
			const results = response.data?.results;

			if (!results || results.length < d) {
				console.log('  No result found at depth', d);
				continue;
			}

			const errorMessage = results[d - 1]?.error_message;
			if (!errorMessage) {
				console.log('  No error message found at depth', d);
				continue;
			}

			console.log(`  Raw error: ${errorMessage.substring(0, 80)}...`);
			const parsed = parseError(iface, errorMessage);
			console.log('  Decoded:', parsed);
		}
		catch (err) {
			console.log('  ERROR fetching from mirror node:', err.message);
		}
	}
};

runScript(main);
