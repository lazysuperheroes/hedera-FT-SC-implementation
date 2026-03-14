const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, runScript } = require('../utils/scriptHelpers');
const { getContractLogs } = require('../utils/hederaMirrorHelpers');

const main = async () => {
	const { operatorId, env } = createHederaClient({ requireOperator: false });
	const { contractId, contractName } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Get Contract Logs',
		env,
		operatorId: operatorId ? operatorId.toString() : '(none)',
		contractId: contractId.toString(),
	});

	const iface = loadInterface(contractName);

	console.log('\n- Fetching logs from mirror node...');
	const logs = await getContractLogs(env, contractId, iface, 100);

	if (logs.length === 0) {
		console.log('  No logs found.');
		return;
	}

	console.log(`  Found ${logs.length} log entries:\n`);

	for (const log of logs) {
		if (log.decoded) {
			let outputStr = `  [${log.decoded.name}] `;
			const args = log.decoded.args;
			for (let i = 0; i < args.length; i++) {
				const field = String(args[i]);
				let output = field;

				// Attempt to convert EVM addresses to Hedera format
				if (field.startsWith('0x') && field.length === 42) {
					try {
						output = `${AccountId.fromSolidityAddress(field).toString()} (${field})`;
					}
					catch {
						// Keep original value
					}
				}

				outputStr += i === 0 ? output : ` : ${output}`;
			}
			console.log(outputStr);
		}
		else {
			console.log(`  [raw] data=${log.data}, topics=${JSON.stringify(log.topics)}`);
		}
	}
};

runScript(main);
