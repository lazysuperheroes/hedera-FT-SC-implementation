const { AccountId, TokenId } = require('@hashgraph/sdk');
const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { printHeader, confirmOrExit, runScript, updateEnvFile, getMultisigOptions } = require('../utils/scriptHelpers');
const { contractExecuteWithMultisig } = require('../utils/multisigHelpers');
const { getAccountBalance, getContractBalance } = require('../utils/hederaHelpers');
const { getBaseURL } = require('../utils/hederaMirrorHelpers');
const { GAS, TOKEN_DEFAULTS } = require('../utils/constants');
require('dotenv').config();

const main = async () => {
	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractId, contractName, tokenDecimals } = getContractConfig();

	if (!contractId) {
		console.log('ERROR: Must specify CONTRACT_ID in .env file. Run deploy first.');
		process.exit(1);
	}

	const tokenName = process.env.TOKEN_NAME;
	const tokenSymbol = process.env.TOKEN_SYMBOL;
	const tokenInitialSupply = Number(process.env.TOKEN_INITIALSUPPLY ?? process.env.TOKEN_INITALSUPPLY);
	const tokenMaxSupply = Number(process.env.TOKEN_MAXSUPPLY) || 0;
	const tokenMemo = (process.env.TOKEN_MEMO || '').slice(0, 100);

	if (!tokenName || !tokenSymbol || isNaN(tokenInitialSupply)) {
		console.log('ERROR: Must specify TOKEN_NAME, TOKEN_SYMBOL, and TOKEN_INITIALSUPPLY in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Mint Fungible Token (No Keys)',
		env,
		operatorId: operatorId.toString(),
		contractId: contractId.toString(),
		additionalInfo: {
			'Token Name': tokenName,
			'Token Symbol': tokenSymbol,
			'Initial Supply': tokenInitialSupply,
			'Decimals': tokenDecimals,
			'Max Supply': tokenMaxSupply || 'Infinite',
			'Memo': tokenMemo || '(none)',
		},
	});

	if (env.toUpperCase() === 'MAIN') {
		confirmOrExit('You are about to mint a token on MAINNET. This is irreversible (no keys). Are you sure?');
	}

	const iface = loadInterface(contractName);
	const multisigOptions = getMultisigOptions();

	console.log('\n- Creating fungible token with no keys...');

	const result = await contractExecuteWithMultisig(
		contractId, iface, client,
		GAS.TOKEN_CREATE,
		'createTokenWithNoKeys',
		[tokenName, tokenSymbol, tokenMemo, tokenInitialSupply, tokenDecimals, tokenMaxSupply],
		multisigOptions,
		TOKEN_DEFAULTS.CREATE_PAYMENT,
	);

	if (!result[0]?.status || result[0].status.toString() !== 'SUCCESS') {
		console.log('ERROR: Token creation failed:', result[0]?.status ?? result[0]);
		process.exit(1);
	}

	// Decode event logs from record
	const record = result[2];
	if (record?.contractFunctionResult?.logs) {
		record.contractFunctionResult.logs.forEach(log => {
			const logStringHex = '0x'.concat(Buffer.from(log.data).toString('hex'));
			const logTopics = log.topics.map(topic => '0x'.concat(Buffer.from(topic).toString('hex')));

			try {
				const event = iface.parseLog({ topics: logTopics, data: logStringHex });
				console.log(`  Event: from '${AccountId.fromEvmAddress(0, 0, event.args.fromAddress).toString()}' - '${event.args.message}'`);
			}
			catch {
				// Skip unparseable logs
			}
		});
	}

	// Extract token address from return value
	const tokenIdSolidityAddr = record?.contractFunctionResult?.getAddress(0);
	if (!tokenIdSolidityAddr) {
		console.log('WARNING: Could not extract token address from record');
		console.log('Record:', JSON.stringify(record, null, 2));
		process.exit(1);
	}

	const tokenId = TokenId.fromSolidityAddress(tokenIdSolidityAddr);

	console.log('\nToken (with no keys!) created successfully!');
	console.log(`  Token ID: ${tokenId}`);
	console.log(`  Solidity Address: ${tokenIdSolidityAddr}`);

	const baseUrl = getBaseURL(env);
	const hashScanBase = env.toUpperCase() === 'MAIN' ? 'https://hashscan.io/#/mainnet' : 'https://hashscan.io/#/testnet';

	console.log(`\n  Mirror Node: ${baseUrl}/api/v1/tokens/${tokenId}`);
	console.log(`  HashScan: ${hashScanBase}/token/${tokenId}`);

	// Show balances
	const [acctTokenBal, accountHbarBal] = await getAccountBalance(client, operatorId, tokenId, tokenDecimals);
	const [contractTokenBal, contractHbarBal] = await getContractBalance(client, contractId, tokenId, tokenDecimals);

	console.log(`\n  Operator ${operatorId}: ${acctTokenBal} tokens, ${accountHbarBal} HBAR`);
	console.log(`  Contract ${contractId}: ${contractTokenBal} tokens, ${contractHbarBal} HBAR`);

	// Auto-update .env with new token ID
	updateEnvFile('TOKEN_ID', tokenId.toString());
};

runScript(main);
