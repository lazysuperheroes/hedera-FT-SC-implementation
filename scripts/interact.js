const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, runScript, formatTokenAmount } = require('../utils/scriptHelpers');
const { contractExecuteQuery } = require('../utils/solidityHelpers');
const { checkMirrorBalance } = require('../utils/hederaMirrorHelpers');
const { GAS } = require('../utils/constants');

const main = async () => {
	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractId, contractName, tokenId, tokenDecimals } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Contract Interaction (Query)',
		env,
		operatorId: operatorId.toString(),
		contractId: contractId.toString(),
		additionalInfo: {
			'Token': tokenId ? tokenId.toString() : '(not set)',
		},
	});

	const iface = loadInterface(contractName);

	// Show contract balance via mirror node (free)
	if (tokenId) {
		const { tokenBalance, hbarBalance } = await checkMirrorBalance(env, contractId.toString(), tokenId);
		console.log('\nContract Balance:');
		console.log(`  Token: ${formatTokenAmount(tokenBalance, tokenDecimals)}`);
		console.log(`  HBAR: ${hbarBalance / 1e8} (tinybars: ${hbarBalance})`);
	}

	// Query allowance whitelist via consensus (costs HBAR)
	console.log('\n- Querying allowance whitelist...');
	try {
		const queryResult = await contractExecuteQuery(
			contractId, iface, client,
			GAS.QUERY,
			'getAllowanceWhitelist',
			[],
			null,
		);

		const wlAccounts = queryResult.wl ?? queryResult[0];
		if (!wlAccounts || wlAccounts.length === 0) {
			console.log('  No accounts in the whitelist.');
		}
		else {
			console.log(`  Whitelist (${wlAccounts.length} accounts):`);
			for (const acctEVM of wlAccounts) {
				const acctId = AccountId.fromEvmAddress(0, 0, acctEVM);
				console.log(`    ${acctEVM} -> ${acctId.toString()}`);
			}
		}
	}
	catch (err) {
		console.log('  ERROR querying whitelist:', err.message || err);
	}
};

runScript(main);
