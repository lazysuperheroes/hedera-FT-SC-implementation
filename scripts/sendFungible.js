const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, confirmOrExit, logResult, runScript, getMultisigOptions } = require('../utils/scriptHelpers');
const { contractExecuteWithMultisig } = require('../utils/multisigHelpers');
const { GAS } = require('../utils/constants');
const { getArgFlag, getArg } = require('../utils/nodeHelpers');

const main = async () => {
	if (getArgFlag('h')) {
		console.log('Usage: node sendFungible.js -amt <amount> -acct <account> [--multisig]');
		console.log('       -amt     amount to send (in token units)');
		console.log('       -acct    recipient Hedera account (0.0.XXX)');
		console.log('       --multisig  use multi-sig signing');
		process.exit(0);
	}

	if (!getArgFlag('amt')) {
		console.log('ERROR: Please specify amount with -amt');
		process.exit(1);
	}
	if (!getArgFlag('acct')) {
		console.log('ERROR: Please specify recipient account with -acct');
		process.exit(1);
	}

	const amount = Number(getArg('amt'));
	const recipientId = AccountId.fromString(getArg('acct'));

	if (isNaN(amount) || amount <= 0) {
		console.log('ERROR: Amount must be a positive number');
		process.exit(1);
	}

	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractId, contractName, tokenId, tokenDecimals } = getContractConfig();

	if (!contractId || !tokenId) {
		console.log('ERROR: Must specify CONTRACT_ID and TOKEN_ID in .env file');
		process.exit(1);
	}

	const rawAmount = Math.floor(amount * (10 ** tokenDecimals));

	printHeader({
		scriptName: 'Send Fungible Token',
		env,
		operatorId: operatorId.toString(),
		contractId: contractId.toString(),
		additionalInfo: {
			'Token': tokenId.toString(),
			'Recipient': recipientId.toString(),
			'Amount': `${amount} (${rawAmount} raw, ${tokenDecimals} decimals)`,
		},
	});

	confirmOrExit(`Send ${amount} tokens to ${recipientId.toString()}?`);

	const iface = loadInterface(contractName);
	const multisigOptions = getMultisigOptions();

	const result = await contractExecuteWithMultisig(
		contractId, iface, client,
		GAS.TOKEN_TRANSFER,
		'transferHTS',
		[tokenId.toSolidityAddress(), recipientId.toSolidityAddress(), rawAmount],
		multisigOptions,
	);

	logResult(result, 'Token Transfer');
};

runScript(main);
