const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { printHeader, runScript, formatTokenAmount } = require('../utils/scriptHelpers');
const { checkMirrorAllowance } = require('../utils/hederaMirrorHelpers');
const { getArgFlag, getArg } = require('../utils/nodeHelpers');

const main = async () => {
	if (getArgFlag('h')) {
		console.log('Usage: node checkAllowance.js -owner <account_id> -spender <account_id>');
		console.log('       -owner    token owner account (0.0.XXX)');
		console.log('       -spender  spender account to check allowance for (0.0.XXX)');
		console.log('');
		console.log('  Checks TOKEN_ID allowance via mirror node (free, no HBAR cost).');
		process.exit(0);
	}

	if (!getArgFlag('owner')) {
		console.log('ERROR: Please specify owner account with -owner');
		process.exit(1);
	}
	if (!getArgFlag('spender')) {
		console.log('ERROR: Please specify spender account with -spender');
		process.exit(1);
	}

	const ownerId = AccountId.fromString(getArg('owner'));
	const spenderId = AccountId.fromString(getArg('spender'));

	const { env } = createHederaClient({ requireOperator: false });
	const { tokenId, tokenDecimals } = getContractConfig();

	if (!tokenId) {
		console.log('ERROR: Must specify TOKEN_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Check Allowance (Mirror Node)',
		env,
		additionalInfo: {
			'Token': tokenId.toString(),
			'Owner': ownerId.toString(),
			'Spender': spenderId.toString(),
		},
	});

	console.log('\n- Checking allowance via mirror node...');
	const rawAllowance = await checkMirrorAllowance(env, ownerId, tokenId, spenderId);

	console.log(`  Raw allowance: ${rawAllowance}`);
	console.log(`  Adjusted allowance: ${formatTokenAmount(rawAllowance, tokenDecimals)}`);

	if (rawAllowance === 0) {
		console.log('  No allowance found (or not yet propagated to mirror node).');
	}
};

runScript(main);
