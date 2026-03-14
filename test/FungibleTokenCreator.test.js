const {
	Client,
	AccountId,
	PrivateKey,
	ContractCallQuery,
	Hbar,
	HbarUnit,
	ReceiptStatusError,
	TransferTransaction,
	TransactionId,
	TokenId,
} = require('@hashgraph/sdk');
const { expect } = require('chai');
const { describe, it, after } = require('mocha');

const { loadInterface, loadBytecode } = require('../utils/abiLoader');
const { contractDeployFunction, contractExecuteFunction } = require('../utils/solidityHelpers');
const {
	accountCreator,
	getAccountBalance,
	getContractBalance,
	associateTokenToAccount,
	hbarTransfer,
} = require('../utils/hederaHelpers');
const { GAS } = require('../utils/constants');

require('dotenv').config();

// Get operator from .env file
const operatorKey = PrivateKey.fromString(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = 'FungibleTokenCreator';

const addressRegex = /(\d+\.\d+\.[1-9]\d+)/i;

// reused variable
let contractId;
let contractAddress;
let iface;
let alicePk, aliceId;
let bobPk, bobId;
let tokenId;
let tokenIdSolidityAddr;
let tokenDecimal;
let contractFTSupply = 0;
let operatorAcctFTSupply = 0;
const amountForBob = 5;


const client = Client.forTestnet().setOperator(operatorId, operatorKey);

describe('Deployment: ', function() {
	it('Should deploy the contract and setup conditions', async function() {
		if (contractName === undefined || contractName == null) {
			console.log('Environment required, please specify CONTRACT_NAME for ABI in the .env file');
			process.exit(1);
		}
		if (operatorKey === undefined || operatorKey == null || operatorId === undefined || operatorId == null) {
			console.log('Environment required, please specify PRIVATE_KEY & ACCOUNT_ID in the .env file');
			process.exit(1);
		}

		console.log('\n-Testing:', contractName);
		// create Alice account
		alicePk = PrivateKey.generateED25519();
		aliceId = await accountCreator(client, alicePk, 80);
		console.log('Alice account ID:', aliceId.toString());

		// create Bob account
		bobPk = PrivateKey.generateED25519();
		bobId = await accountCreator(client, bobPk, 20);
		console.log('Bob account ID:', bobId.toString());


		client.setOperator(operatorId, operatorKey);
		// deploy the contract
		console.log('\n-Using Operator:', operatorId.toString());

		iface = loadInterface(contractName);
		const contractBytecode = loadBytecode(contractName);
		const gasLimit = GAS.CONTRACT_DEPLOY;

		console.log('\n- Deploying contract...', contractName, '\n\tgas@', gasLimit);

		[contractId, contractAddress] = await contractDeployFunction(client, contractBytecode, gasLimit);

		console.log(`Contract created with ID: ${contractId} / ${contractAddress}`);

		expect(contractId.toString()).to.match(addressRegex);
	});
});

/** */
describe('Mint the fungible token', function() {
	it('Check only owner can call to mint', async function() {
		client.setOperator(aliceId, alicePk);
		const [result] = await mintFungible('Alice', 'AT', 'Memo', 10, 0, 0, 60);
		// Expect the call to fail since Alice is not the owner
		expect(result.status.toString()).to.not.equal('SUCCESS');
	});

	it('Owner mints a FT', async function() {
		contractFTSupply = 100000;
		client.setOperator(operatorId, operatorKey);
		tokenDecimal = 2;
		await mintFungible('TestToken', 'TT', 'Test Token', contractFTSupply, tokenDecimal, 0, 30);
		expect(tokenId.toString()).to.match(addressRegex);
	});

	it('Ensure the balance of FT is correct', async function() {
		// Pass tokenDecimal=0 to get raw balance matching contractFTSupply
		const [contractTokenBal] = await getContractBalance(client, contractId, tokenId, 0);
		expect(Number(contractTokenBal)).to.be.equal(contractFTSupply);
	});
});

describe('Interaction: ', function() {
	it('Associate token to Operator, Alice & Bob', async function() {
		client.setOperator(operatorId, operatorKey);
		let result = await associateTokenToAccount(client, operatorId, operatorKey, tokenId);
		expect(result).to.be.equal('SUCCESS');

		client.setOperator(aliceId, alicePk);
		result = await associateTokenToAccount(client, aliceId, alicePk, tokenId);
		expect(result).to.be.equal('SUCCESS');

		client.setOperator(bobId, bobPk);
		result = await associateTokenToAccount(client, bobId, bobPk, tokenId);
		expect(result).to.be.equal('SUCCESS');
	});

	it('Transfer Fungible as ERC20', async function() {
		client.setOperator(operatorId, operatorKey);

		const amount = 5;
		contractFTSupply -= amount * (10 ** tokenDecimal);
		operatorAcctFTSupply += amount;

		const result = await transferFungible(operatorId, amount);
		const [acctTokenBal] = await getAccountBalance(client, operatorId, tokenId, tokenDecimal);

		expect(result).to.be.equal('SUCCESS');
		expect(acctTokenBal).to.be.equal(operatorAcctFTSupply);
	});

	it('Transfer Fungible using HTS', async function() {
		client.setOperator(operatorId, operatorKey);

		const amount = 10;
		contractFTSupply -= amount * (10 ** tokenDecimal);
		operatorAcctFTSupply += amount;

		const result = await transferFungibleWithHTS(operatorId, amount);
		const [acctTokenBal] = await getAccountBalance(client, operatorId, tokenId, tokenDecimal);

		expect(result).to.be.equal('SUCCESS');
		expect(acctTokenBal).to.be.equal(operatorAcctFTSupply);
	});

	it('Check Allowance WL is empty', async function() {
		client.setOperator(operatorId, operatorKey);

		const wl = await getAllowanceWL();

		expect(wl.length).to.be.equal(0);
	});

	it('Add Alice to Allowance WL', async function() {
		client.setOperator(operatorId, operatorKey);

		await addAddressToWL(aliceId);
	});

	it('Verify the Allowance WL', async function() {
		client.setOperator(operatorId, operatorKey);

		const wl = await getAllowanceWL();

		expect(wl.length).to.be.equal(1);
		expect(wl[0].toUpperCase() == ('0x' + aliceId.toSolidityAddress()).toUpperCase()).to.be.true;

		let status = await checkIfWL(aliceId);
		expect(status[0]).to.be.true;

		status = await checkIfWL(operatorId);
		expect(status[0]).to.be.false;
	});

	it('Test unable to set allowance for operator as not on WL', async function() {
		client.setOperator(operatorId, operatorKey);

		const [result] = await approveAllowanceRaw(operatorId, amountForBob);
		// Expect the call to fail since operator is not on the allowance whitelist
		expect(result.status.toString()).to.not.equal('SUCCESS');
	});

	it('Test unable to send using allowance if unset', async function() {
		client.setOperator(operatorId, operatorKey);

		// check allowance is zero
		const allowance = await checkAllowance(operatorId);
		expect(allowance).to.be.equal(0);

		// expect it to fail when used given 0
		let errorCount = 0;
		try {
			await testUsingApproval(AccountId.fromString(contractId.toString()), bobId, 5, operatorId, operatorKey);
		}
		catch (err) {
			if (err instanceof ReceiptStatusError && (err.status._code == 7 || err.status._code == 292)) {
				errorCount++;
			}
			else {
				console.log('Test unable to send using allowance if unset', err);
			}
		}
		expect(errorCount).to.be.equal(1);
	});

	it('Approve allowance for Alice', async function() {
		client.setOperator(operatorId, operatorKey);
		const result = await approveAllowance(aliceId, amountForBob);
		expect(result).to.be.equal('SUCCESS');
	});

	it('Test allowance for Alice to send FT to Bob', async function() {
		client.setOperator(aliceId, alicePk);

		contractFTSupply -= amountForBob * (10 ** tokenDecimal);

		const result = await testUsingApproval(AccountId.fromString(contractId.toString()), bobId, amountForBob, aliceId, alicePk);
		const [acctTokenBal] = await getAccountBalance(client, bobId, tokenId, tokenDecimal);

		expect(result).to.be.equal('SUCCESS');
		expect(acctTokenBal).to.be.equal(amountForBob);
	});

	it('Test send with allowance **used up** for Alice', async function() {
		client.setOperator(aliceId, alicePk);

		// check allowance is zero
		const allowance = await checkAllowance(operatorId);
		expect(allowance).to.be.equal(0);

		// expect it to fail when used given 0
		let errorCount = 0;
		try {
			await testUsingApproval(AccountId.fromString(contractId.toString()), bobId, 5, aliceId, alicePk);
		}
		catch (err) {
			if (err instanceof ReceiptStatusError && (err.status._code == 7 || err.status._code == 292)) {
				errorCount++;
			}
			else {
				console.log('Test send with allowance **used up** for Alice', err);
			}
		}
		expect(errorCount).to.be.equal(1);
	});

	it('Remove Alice from Allowance WL', async function() {
		client.setOperator(operatorId, operatorKey);

		const result = await removeAddressFromWL(aliceId);
		expect(result).to.be.equal('SUCCESS');
	});

	it('Send Hbar to the contract', async function() {
		client.setOperator(operatorId, operatorKey);

		const amount = 10;
		const result = await hbarTransfer(client, operatorId, AccountId.fromString(contractId.toString()), amount, operatorKey);

		expect(result).to.be.equal('SUCCESS');

	});

	it('Retrieve Hbar with transfer', async function() {
		client.setOperator(operatorId, operatorKey);

		const amount = 4;
		const result = await transferHbarFromContract(amount);

		expect(result).to.be.equal('SUCCESS');
	});

	it('Check Alice can not execute sensitive calls', async function() {
		client.setOperator(aliceId, alicePk);

		let failCount = 0;

		// Each of these calls should fail because Alice is not the owner.
		// The shared contractExecuteFunction catches execution/receipt errors
		// and returns a non-SUCCESS status rather than throwing.
		let [result] = await transferFungibleWithHTSRaw(aliceId, 1);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		[result] = await transferFungibleRaw(aliceId, 1);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		// mintAdditionalSupply and burnFromTreasury exist in the ABI but
		// require a supply key. Since the token was created with no keys,
		// these calls will fail at the HTS precompile level.
		[result] = await mintAdditionalSupply(1);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		[result] = await executeBurnWithSupply(1);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		[result] = await addAddressToWLRaw(aliceId);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		[result] = await transferHbarFromContractRaw(0.1);
		if (result.status.toString() !== 'SUCCESS') failCount++;

		expect(failCount).to.be.equal(6);
	});

	it('Check Alice *CAN* execute non-sensitive calls', async function() {
		client.setOperator(aliceId, alicePk);

		const wl = await getAllowanceWL();

		expect(wl.length).to.be.equal(0);

		const status = await checkIfWL(aliceId);
		expect(status[0]).to.be.false;

		const allowance = await checkAllowance(aliceId);
		expect(allowance).to.be.equal(0);
	});

	after('Retrieve any hbar spent', async function() {
		client.setOperator(operatorId, operatorKey);
		// get Alice balance
		const [, aliceHbarBal] = await getAccountBalance(client, aliceId, tokenId, tokenDecimal);
		// SDK transfer back to operator
		let receipt = await hbarTransfer(client, aliceId, operatorId, aliceHbarBal.toBigNumber().minus(0.01), alicePk);
		console.log('Clean-up -> Retrieve hbar from Alice');
		expect(receipt == 'SUCCESS').to.be.true;

		// get bob balance
		const [, bobHbarBal] = await getAccountBalance(client, bobId, tokenId, tokenDecimal);
		// SDK transfer back to operator
		receipt = await hbarTransfer(client, bobId, operatorId, bobHbarBal.toBigNumber().minus(0.01), bobPk);
		console.log('Clean-up -> Retrieve hbar from Bob');
		expect(receipt == 'SUCCESS').to.be.true;

		client.setOperator(operatorId, operatorKey);
		let [, contractHbarBal] = await getContractBalance(client, contractId, tokenId, 0);
		const result = await transferHbarFromContract(Number(contractHbarBal.toTinybars()), HbarUnit.Tinybar);
		console.log('Clean-up -> Retrieve hbar from Contract');
		[, contractHbarBal] = await getContractBalance(client, contractId, tokenId, 0);
		console.log('Contract ending hbar balance:', contractHbarBal.toString());
		expect(result).to.be.equal('SUCCESS');
	});
});

/**
 * Helper function to encapsulate minting an FT
 * @param {string} tokenName
 * @param {string} tokenSymbol
 * @param {string} tokenMemo
 * @param {number} tokenInitialSupply
 * @param {number} decimal
 * @param {number} tokenMaxSupply
 * @param {number} payment
 * @returns {Array} Result from contractExecuteFunction
 */
async function mintFungible(tokenName, tokenSymbol, tokenMemo, tokenInitialSupply, decimal, tokenMaxSupply, payment) {
	const gasLim = GAS.TOKEN_CREATE;
	const params = [tokenName, tokenSymbol, tokenMemo, tokenInitialSupply, decimal, tokenMaxSupply];

	const result = await contractExecuteFunction(contractId, iface, client, gasLim, 'createTokenWithNoKeys', params, payment);

	// On success, extract the token address from the record
	if (result[2]?.contractFunctionResult) {
		tokenIdSolidityAddr = result[2].contractFunctionResult.getAddress(0);
		tokenId = TokenId.fromSolidityAddress(tokenIdSolidityAddr);
	}

	return result;
}


/**
 * Helper method to transfer FT using ERC20 method
 * @param {AccountId} receiver
 * @param {number} amount amount of the FT to transfer as 'whole units' decimals added in the method
 * @returns {string} expected to be 'SUCCESS'
 */
async function transferFungible(receiver, amount) {
	const gasLim = 400000;
	const params = [tokenIdSolidityAddr, receiver.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	const [tokenTransferRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'transfer', params);
	return tokenTransferRx.status.toString();
}

/**
 * Raw version of transferFungible that returns the full result array
 * for checking error status without throwing
 * @param {AccountId} receiver
 * @param {number} amount
 * @returns {Array} Result from contractExecuteFunction
 */
async function transferFungibleRaw(receiver, amount) {
	const gasLim = 400000;
	const params = [tokenIdSolidityAddr, receiver.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'transfer', params);
}

/**
 * Helper method to transfer FT using HTS
 * @param {AccountId} receiver
 * @param {number} amount amount of the FT to transfer as 'whole units' decimals added in the method
 * @returns {string} expected to be 'SUCCESS'
 */
async function transferFungibleWithHTS(receiver, amount) {
	const gasLim = 600000;
	const params = [tokenIdSolidityAddr, receiver.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	const [tokenTransferRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'transferHTS', params);
	return tokenTransferRx.status.toString();
}

/**
 * Raw version of transferFungibleWithHTS that returns the full result array
 * for checking error status without throwing
 * @param {AccountId} receiver
 * @param {number} amount
 * @returns {Array} Result from contractExecuteFunction
 */
async function transferFungibleWithHTSRaw(receiver, amount) {
	const gasLim = 600000;
	const params = [tokenIdSolidityAddr, receiver.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'transferHTS', params);
}

/**
 * Calls mintAdditionalSupply on the contract.
 * NOTE: This method does not exist in the no-keys version of the contract.
 * Calls are expected to revert, used to verify that non-existent methods fail.
 * @param {number} amount
 * @returns {Array} Result from contractExecuteFunction
 */
async function mintAdditionalSupply(amount) {
	const gasLim = 500000;
	const params = [tokenIdSolidityAddr, amount * (10 ** tokenDecimal)];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'mintAdditionalSupply', params);
}

/**
 * Calls burnFromTreasury on the contract (requires supply key).
 * When token is created with no keys, this will fail at the HTS precompile.
 * @param {number} amount
 * @returns {Array} Result from contractExecuteFunction
 */
async function executeBurnWithSupply(amount) {
	const gasLim = 500000;
	const params = [tokenIdSolidityAddr, amount * (10 ** tokenDecimal), [1]];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'burnFromTreasury', params);
}

/**
 * Helper method to return the array of addresses in the WL
 * @returns {Array} array of EVM addresses on the whitelist
 */
async function getAllowanceWL() {
	const functionCallAsUint8Array = iface.encodeFunctionData('getAllowanceWhitelist', []);

	const contractCall = await new ContractCallQuery()
		.setContractId(contractId)
		.setFunctionParameters(Buffer.from(functionCallAsUint8Array.slice(2), 'hex'))
		.setMaxQueryPayment(new Hbar(2))
		.setGas(GAS.QUERY)
		.execute(client);

	const results = iface.decodeFunctionResult('getAllowanceWhitelist', contractCall.bytes);
	return results.wl;
}

async function transferHbarFromContract(amount, units = HbarUnit.Hbar) {
	const gasLim = 400000;
	const params = [operatorId.toSolidityAddress(), Number(new Hbar(amount, units).toTinybars())];
	const [callHbarRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'transferHbar', params);
	return callHbarRx.status.toString();
}

/**
 * Raw version of transferHbarFromContract for checking error status
 * @param {number} amount
 * @param {HbarUnit} units
 * @returns {Array} Result from contractExecuteFunction
 */
async function transferHbarFromContractRaw(amount, units = HbarUnit.Hbar) {
	const gasLim = 400000;
	const params = [operatorId.toSolidityAddress(), Number(new Hbar(amount, units).toTinybars())];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'transferHbar', params);
}

async function addAddressToWL(address) {
	const gasLim = 400000;
	const params = [address.toSolidityAddress()];
	const [callHbarRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'addAllowanceWhitelist', params);
	return callHbarRx.status.toString();
}

/**
 * Raw version of addAddressToWL for checking error status
 * @param {AccountId} address
 * @returns {Array} Result from contractExecuteFunction
 */
async function addAddressToWLRaw(address) {
	const gasLim = 400000;
	const params = [address.toSolidityAddress()];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'addAllowanceWhitelist', params);
}

async function checkIfWL(address) {
	const functionCallAsUint8Array = iface.encodeFunctionData('isAddressWL', [address.toSolidityAddress()]);

	const contractCall = await new ContractCallQuery()
		.setContractId(contractId)
		.setFunctionParameters(Buffer.from(functionCallAsUint8Array.slice(2), 'hex'))
		.setMaxQueryPayment(new Hbar(2))
		.setGas(GAS.QUERY)
		.execute(client);

	return iface.decodeFunctionResult('isAddressWL', contractCall.bytes);
}

/**
 * Helper method to check the allowance on an account
 * @param {AccountId} spender check allowance for this potential spender
 * @returns {Number} the allowance of the FT for the designated spender
 */
async function checkAllowance(spender) {
	const gasLim = 400000;
	const params = [tokenIdSolidityAddr, spender.toSolidityAddress()];
	const [, contractOutput] = await contractExecuteFunction(contractId, iface, client, gasLim, 'checkAllowance', params);

	return Number(contractOutput.amount);
}

/**
 * Function to test using approvals granted via SDK TransferTransaction
 * @param {AccountId} from The account that owns the tokens
 * @param {AccountId} to The account receiving the tokens
 * @param {Number} amount amount of token to send
 * @param {AccountId} authSpender the account of the authorised spender who must create the tx ID and sign
 * @param {PrivateKey} authSpenderKey the key to sign with
 * @returns {string} Transaction status
 */
async function testUsingApproval(from, to, amount, authSpender, authSpenderKey) {
	const transferTx = new TransferTransaction()
		.addApprovedTokenTransfer(tokenId, from, -amount * (10 ** tokenDecimal))
		.addTokenTransfer(tokenId, to, amount * (10 ** tokenDecimal))
		// signing account must generate the tx ID (currently undocumented - raised with hedera)
		.setTransactionId(TransactionId.generate(authSpender))
		.setTransactionMemo('Spending with allowances')
		.freezeWith(client);
	const transferSign = await transferTx.sign(authSpenderKey);
	const transferSubmit = await transferSign.execute(client);
	const transferRx = await transferSubmit.getReceipt(client);
	return transferRx.status.toString();
}

async function approveAllowance(spender, amount) {
	const gasLim = GAS.ALLOWANCE_APPROVE;
	const params = [tokenIdSolidityAddr, spender.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	const [callHbarRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'approveAllowance', params);
	return callHbarRx.status.toString();
}

/**
 * Raw version of approveAllowance for checking error status
 * @param {AccountId} spender
 * @param {number} amount
 * @returns {Array} Result from contractExecuteFunction
 */
async function approveAllowanceRaw(spender, amount) {
	const gasLim = GAS.ALLOWANCE_APPROVE;
	const params = [tokenIdSolidityAddr, spender.toSolidityAddress(), amount * (10 ** tokenDecimal)];
	return await contractExecuteFunction(contractId, iface, client, gasLim, 'approveAllowance', params);
}

async function removeAddressFromWL(address) {
	const gasLim = 400000;
	const params = [address.toSolidityAddress()];
	const [callHbarRx] = await contractExecuteFunction(contractId, iface, client, gasLim, 'removeAllowanceWhitelist', params);
	return callHbarRx.status.toString();
}
