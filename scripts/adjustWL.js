const { AccountId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, confirmOrExit, logResult, runScript, getMultisigOptions } = require('../utils/scriptHelpers');
const { contractExecuteWithMultisig } = require('../utils/multisigHelpers');
const { contractExecuteQuery } = require('../utils/solidityHelpers');
const { GAS } = require('../utils/constants');
const { getArgFlag, getArg } = require('../utils/nodeHelpers');

const main = async () => {
	if (getArgFlag('h')) {
		console.log('Usage: node adjustWL.js [-add 0.0.XXX] [-rem 0.0.XXX] [-check] [--multisig]');
		console.log('       -add        add account to allowance whitelist');
		console.log('       -rem        remove account from allowance whitelist');
		console.log('       -check      query current whitelist');
		console.log('       --multisig  use multi-sig signing');
		process.exit(0);
	}

	const isAdd = getArgFlag('add');
	const isRemove = getArgFlag('rem');
	const isCheck = getArgFlag('check');

	if (!isAdd && !isRemove && !isCheck) {
		console.log('ERROR: Must specify -add, -rem, or -check');
		process.exit(1);
	}

	let accountId;
	let operation;

	if (isAdd) {
		accountId = AccountId.fromString(getArg('add'));
		operation = `add ${accountId.toString()} to`;
	}
	else if (isRemove) {
		accountId = AccountId.fromString(getArg('rem'));
		operation = `remove ${accountId.toString()} from`;
	}
	else {
		operation = 'check';
	}

	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractId, contractName } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Adjust Allowance Whitelist',
		env,
		operatorId: operatorId.toString(),
		contractId: contractId.toString(),
		additionalInfo: {
			'Operation': operation,
		},
	});

	const iface = loadInterface(contractName);
	const multisigOptions = getMultisigOptions();

	if (isAdd || isRemove) {
		confirmOrExit(`Do you want to ${operation} the whitelist?`);

		const fcnName = isAdd ? 'addAllowanceWhitelist' : 'removeAllowanceWhitelist';
		const result = await contractExecuteWithMultisig(
			contractId, iface, client,
			GAS.STANDARD,
			fcnName,
			[accountId.toSolidityAddress()],
			multisigOptions,
		);

		logResult(result, `Whitelist ${isAdd ? 'Add' : 'Remove'}`);
	}

	// Always show current whitelist after modification or on -check
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
