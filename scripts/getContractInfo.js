const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { printHeader, runScript, formatTokenAmount } = require('../utils/scriptHelpers');
const { getContractInfo, checkMirrorBalance } = require('../utils/hederaMirrorHelpers');

const main = async () => {
	const { operatorId, env } = createHederaClient({ requireOperator: false });
	const { contractId, tokenId, tokenDecimals } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Get Contract Info (Mirror Node)',
		env,
		operatorId: operatorId ? operatorId.toString() : '(none)',
		contractId: contractId.toString(),
	});

	// Fetch contract info from mirror node (free)
	console.log('\n- Fetching contract info from mirror node...');
	const info = await getContractInfo(env, contractId);

	if (!info) {
		console.log('  ERROR: Could not retrieve contract info from mirror node.');
		process.exit(1);
	}

	console.log(`  Contract ID: ${info.contract_id}`);
	console.log(`  EVM Address: ${info.evm_address}`);
	console.log(`  Bytecode File: ${info.file_id || '(none)'}`);
	console.log(`  Auto-Renew Account: ${info.auto_renew_account || '(none)'}`);
	console.log(`  Auto-Renew Period: ${info.auto_renew_period ? info.auto_renew_period + 's' : '(none)'}`);
	console.log(`  Created: ${info.created_timestamp}`);
	console.log(`  Expiry: ${info.expiration_timestamp}`);
	console.log(`  Deleted: ${info.deleted}`);
	console.log(`  Memo: ${info.memo || '(none)'}`);
	console.log(`  Max Auto Associations: ${info.max_automatic_token_associations ?? '(default)'}`);

	// Get balance from mirror node (free)
	console.log('\n- Fetching balance from mirror node...');
	const { tokenBalance, hbarBalance } = await checkMirrorBalance(env, contractId.toString(), tokenId);

	console.log(`  HBAR Balance: ${hbarBalance / 1e8} (tinybars: ${hbarBalance})`);
	if (tokenId) {
		console.log(`  Token (${tokenId.toString()}) Balance: ${formatTokenAmount(tokenBalance, tokenDecimals)}`);
	}
};

runScript(main);
