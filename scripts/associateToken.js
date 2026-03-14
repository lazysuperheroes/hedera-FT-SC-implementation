const { AccountId, PrivateKey } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { printHeader, confirmOrExit, runScript } = require('../utils/scriptHelpers');
const { associateTokenToAccount } = require('../utils/hederaHelpers');
const { getArgFlag, getArg } = require('../utils/nodeHelpers');

const main = async () => {
	if (getArgFlag('h')) {
		console.log('Usage: node associateToken.js -acct <account_id> -key <private_key>');
		console.log('       -acct    account to associate the token with (0.0.XXX)');
		console.log('       -key     private key of the account (ED25519 or ECDSA hex)');
		console.log('');
		console.log('  Associates the TOKEN_ID from .env with the specified account.');
		console.log('  Required before the account can receive the token.');
		process.exit(0);
	}

	if (!getArgFlag('acct')) {
		console.log('ERROR: Please specify account with -acct');
		process.exit(1);
	}
	if (!getArgFlag('key')) {
		console.log('ERROR: Please specify account private key with -key');
		process.exit(1);
	}

	const accountId = AccountId.fromString(getArg('acct'));

	let accountKey;
	try {
		accountKey = PrivateKey.fromStringED25519(getArg('key'));
	}
	catch {
		try {
			accountKey = PrivateKey.fromStringECDSA(getArg('key'));
		}
		catch {
			console.log('ERROR: Could not parse private key. Provide a valid ED25519 or ECDSA key.');
			process.exit(1);
		}
	}

	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { tokenId } = getContractConfig();

	if (!tokenId) {
		console.log('ERROR: Must specify TOKEN_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Associate Token',
		env,
		operatorId: operatorId.toString(),
		additionalInfo: {
			'Token': tokenId.toString(),
			'Account': accountId.toString(),
		},
	});

	confirmOrExit(`Associate token ${tokenId.toString()} with account ${accountId.toString()}?`);

	console.log('\n- Associating token...');
	const status = await associateTokenToAccount(client, accountId, accountKey, tokenId);

	console.log(`  Association status: ${status}`);
};

runScript(main);
