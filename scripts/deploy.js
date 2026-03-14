const { createHederaClient, getContractConfig } = require('../utils/clientFactory');
const { loadBytecode } = require('../utils/abiLoader');
const { contractDeployFunction } = require('../utils/solidityHelpers');
const { printHeader, confirmOrExit, runScript, updateEnvFile } = require('../utils/scriptHelpers');
const { GAS } = require('../utils/constants');

const main = async () => {
	const { client, operatorId, env } = createHederaClient({ requireOperator: true });
	const { contractName } = getContractConfig();

	if (!contractName) {
		console.log('ERROR: Must specify CONTRACT_NAME in .env file');
		process.exit(1);
	}

	printHeader({
		scriptName: 'Deploy Contract',
		env,
		operatorId: operatorId.toString(),
		additionalInfo: { 'Contract': contractName },
	});

	if (env.toUpperCase() === 'MAIN') {
		confirmOrExit('You are about to deploy to MAINNET. Are you sure?');
	}

	const bytecode = loadBytecode(contractName);

	console.log('\n- Deploying contract...');
	const [contractId, contractAddress] = await contractDeployFunction(client, bytecode, GAS.CONTRACT_DEPLOY);

	console.log('\nContract deployed successfully!');
	console.log(`  Contract ID: ${contractId}`);
	console.log(`  Solidity Address: ${contractAddress}`);

	// Auto-update .env with new contract ID
	updateEnvFile('CONTRACT_ID', contractId.toString());
};

runScript(main);
