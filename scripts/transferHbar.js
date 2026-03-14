const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, confirmOrExit, logResult, runScript, getMultisigOptions } = require('../utils/scriptHelpers');
const { contractExecuteWithMultisig } = require('../utils/multisigHelpers');
const { GAS } = require('../utils/constants');
const { getArgFlag, getArg } = require('../utils/nodeHelpers');

const main = async () => {
	if (getArgFlag('h')) {
		console.log('Usage: node transferHbar.js -amt <amount> -acct <receiver_address> [--multisig]');
		console.log('       -amt       amount of HBAR to transfer from the contract');
		console.log('       -acct      receiver Hedera account (0.0.XXX)');
		console.log('       --multisig use multi-sig signing');
		process.exit(0);
	}

	if (!getArgFlag('amt')) {
		console.log('ERROR: Please specify HBAR amount with -amt');
		process.exit(1);
	}
	if (!getArgFlag('acct')) {
		console.log('ERROR: Please specify receiver account with -acct');
		process.exit(1);
	}

	const amount = Number(getArg('amt'));
	const receiverId = AccountId.fromString(getArg('acct'));

	if (isNaN(amount) || amount <= 0) {
		console.log('ERROR: Amount must be a positive number');
		process.exit(1);
	}

	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractId, contractName } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Transfer HBAR from Contract',
		env,
		operatorId: operatorId.toString(),
		contractId: contractId.toString(),
		additionalInfo: {
			'Receiver': receiverId.toString(),
			'Amount (HBAR)': amount,
		},
	});

	confirmOrExit(`Transfer ${amount} HBAR from contract ${contractId.toString()} to ${receiverId.toString()}?`);

	const iface = loadInterface(contractName);
	const multisigOptions = getMultisigOptions();

	// Convert HBAR to tinybars (1 HBAR = 100_000_000 tinybars)
	const amountTinybars = Math.floor(amount * 1e8);

	const result = await contractExecuteWithMultisig(
		contractId, iface, client,
		GAS.HBAR_TRANSFER,
		'transferHbar',
		[receiverId.toSolidityAddress(), amountTinybars],
		multisigOptions,
	);

	logResult(result, 'HBAR Transfer');
};

runScript(main);
