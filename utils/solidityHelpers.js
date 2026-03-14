/**
 * Solidity / Contract Interaction Helpers
 * Standardized contract execution, querying, deployment, and error parsing using ethers v6
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

const { ContractCallQuery, ContractExecuteTransaction, ContractCreateFlow, Client, TransactionRecordQuery } = require('@hashgraph/sdk');
const { getBaseURL } = require('./hederaMirrorHelpers');

const SLEEP_TIME = process.env.SLEEP_TIME ?? 5000;

/**
 * Generalized error parser for contract reverts and panics
 * @param {ethers.Interface} iface - The contract interface
 * @param {string} errorData - Hex-encoded error data
 * @returns {string} Human-readable error message
 */
function parseError(iface, errorData) {
	if (errorData.startsWith('0x08c379a0')) {
		// decode Error(string)
		const content = `0x${errorData.substring(10)}`;
		return `REVERT: ${ethers.AbiCoder.defaultAbiCoder().decode(['string'], content)}`;
	}

	if (errorData.startsWith('0x4e487b71')) {
		// decode Panic(uint)
		const content = `0x${errorData.substring(10)}`;
		const code = ethers.AbiCoder.defaultAbiCoder().decode(['uint'], content);

		let type;
		switch (Number(code[0])) {
		case 0:
			type = 'Generic compiler inserted panic';
			break;
		case 1:
			type = 'Assert with an argument that evaluates to false';
			break;
		case 17:
			type = 'Arithmetic operation results in underflow or overflow outside of an unchecked { ... } block';
			break;
		case 18:
			type = 'Divide or modulo by zero (e.g. 5 / 0 or 23 % 0)';
			break;
		case 33:
			type = 'Convert a value that is too big or negative into an enum type';
			break;
		case 34:
			type = 'Access a storage byte array that is incorrectly encoded';
			break;
		case 49:
			type = 'Call .pop() on an empty array';
			break;
		case 50:
			type = 'Access an array, bytesN or an array slice at an out-of-bounds or negative index';
			break;
		case 65:
			type = 'Allocate too much memory or create an array that is too large';
			break;
		case 81:
			type = 'Call a zero-initialized variable of internal function type';
			break;
		default:
			type = 'Unknown';
		}

		return `Panic code: ${code[0]} : ${type}`;
	}

	try {
		const errDescription = iface.parseError(errorData);
		return errDescription;
	}
	catch (e) {
		console.error(errorData, e);
		return `UNKNOWN ERROR: ${errorData}`;
	}
}

/**
 * Parse error from a transaction ID (via consensus record or mirror node)
 * @param {string | Client} envOrClient - Environment string (mirror, free) or Client (consensus, paid)
 * @param {TransactionId} transactionId - Hedera transaction ID
 * @param {ethers.Interface} iface - The contract interface
 * @returns {string} Parsed error message
 */
async function parseErrorTransactionId(envOrClient, transactionId, iface) {
	if (envOrClient instanceof Client) {
		const record = await new TransactionRecordQuery()
			.setTransactionId(transactionId)
			.setValidateReceiptStatus(false)
			.execute(envOrClient);

		try {
			return parseError(iface, record.contractFunctionResult.errorMessage);
		}
		catch (e) {
			console.error(e);
			return `UNKNOWN ERROR: ${transactionId} / ${record.contractFunctionResult.errorMessage}`;
		}
	}

	let url = getBaseURL(envOrClient);
	await sleep(SLEEP_TIME);

	// convert tx Id format: 0.0.XXXX@11111.11111 -> 0.0.XXXX-11111-11111
	const webFormatTxId = transactionId.accountId.toString() + '-' + transactionId.validStart.toString().substring(0, 10) + '-' + transactionId.validStart.toString().substring(11, 21);
	url += `/api/v1/contracts/results/${webFormatTxId}`;

	const response = await axios.get(url);
	if (response.status != 200) {
		console.log(' -ERROR', response.status, ' from mirror node');
	}
	else {
		return parseError(iface, response.data.error_message);
	}
}

/**
 * Execute a contract function (state-changing)
 * @param {ContractId} contractId - The contract to call
 * @param {ethers.Interface} iface - The contract interface (ABI)
 * @param {Client} client - Hedera client for execution
 * @param {number} gasLim - Gas limit for the transaction
 * @param {string} fcnName - Function name to call
 * @param {Array} params - Function parameters
 * @param {number} amountHbar - HBAR amount to send (default 0)
 * @param {boolean} flagError - Whether to log errors (default false)
 * @returns {[TransactionReceipt, any, TransactionRecord]} Receipt, decoded results, and record
 */
async function contractExecuteFunction(contractId, iface, client, gasLim, fcnName, params = [], amountHbar = 0, flagError = false) {
	if (!gasLim || isNaN(gasLim)) {
		gasLim = 200_000;
	}

	const encodedCommand = iface.encodeFunctionData(fcnName, params);

	let contractExecuteTx;
	try {
		contractExecuteTx = await new ContractExecuteTransaction()
			.setContractId(contractId)
			.setGas(gasLim)
			.setFunctionParameters(Buffer.from(encodedCommand.slice(2), 'hex'))
			.setPayableAmount(amountHbar)
			.execute(client);
	}
	catch (err) {
		if (flagError) console.log('ERROR: Contract Transaction Failed');
		if (!err?.contractFunctionResult?.errorMessage) {
			console.log('Malformed Error:');
			console.dir(err, { depth: 5, colors: true });
		}

		return [(parseError(iface, err?.contractFunctionResult?.errorMessage))];
	}

	let contractExecuteRx;
	try {
		contractExecuteRx = await contractExecuteTx.getReceipt(client);
	}
	catch (e) {
		try {
			const error = await parseErrorTransactionId(client, e.transactionId, iface);
			if (flagError) {
				console.log('ERROR: Fetching Contract Receipt Failed');
				console.log('ERROR:', typeof error, error);
			}
			return [{ status: error }, `${e.transactionId}`, null];
		}
		catch (subError) {
			console.log('ERROR: Parsing Error Failed');
			console.log('ERROR:', e.transactionId, typeof subError, subError);
			return [{ status: e }, `${e.transactionId}`, null];
		}
	}

	// get the results of the function call
	const record = await contractExecuteTx.getRecord(client);

	let contractResults;
	try {
		contractResults = iface.decodeFunctionResult(fcnName, record.contractFunctionResult.bytes);
	}
	catch (e) {
		if (e.data == '0x') {
			console.log(contractExecuteTx.transactionId.toString(), 'No data returned from contract - check the call');
		}
		else {
			console.log('Error', contractExecuteTx.transactionId.toString(), e);
			console.log(parseError(iface, record.contractFunctionResult.bytes));
		}
	}

	return [contractExecuteRx, contractResults, record];
}

/**
 * Execute a read-only contract query (costs HBAR via consensus)
 * @param {ContractId} contractId - The contract to query
 * @param {ethers.Interface} iface - The contract interface
 * @param {Client} client - Hedera client
 * @param {number} gasLim - Gas limit
 * @param {string} fcnName - Function name
 * @param {Array} params - Function parameters
 * @param {Hbar | null} queryCost - Query payment (nullable)
 * @param {...string} expectedVars - Expected return variable names
 * @returns {Array} Decoded query results
 */
async function contractExecuteQuery(contractId, iface, client, gasLim, fcnName, params = [], queryCost, ...expectedVars) {
	if (!gasLim || isNaN(gasLim)) {
		gasLim = 100_000;
	}

	const functionCallAsUint8Array = iface.encodeFunctionData(fcnName, params);

	console.log('Calling function:', fcnName, 'with params:', params, 'on contract:', contractId.toString(), 'with gas limit:', gasLim);

	let contractQuery;
	try {
		const contractQueryTx = new ContractCallQuery()
			.setContractId(contractId)
			.setFunctionParameters(Buffer.from(functionCallAsUint8Array.slice(2), 'hex'))
			.setGas(gasLim);

		if (queryCost) {
			contractQueryTx.setQueryPayment(queryCost);
		}

		contractQuery = await contractQueryTx.execute(client);
	}
	catch (err) {
		console.log('ERROR: Contract Call Failed');
		console.dir(err, { depth: 5, colors: true });
		return [(parseError(iface, err.contractFunctionResult.errorMessage))];
	}

	const queryResult = iface.decodeFunctionResult(fcnName, contractQuery.bytes);
	console.log('Query result:', fcnName, queryResult);

	if (expectedVars.length == 0) {
		return queryResult;
	}
	else {
		const results = [];
		for (let v = 0; v < expectedVars.length; v++) {
			results.push(queryResult[expectedVars[v]]);
		}
		return results;
	}
}

/**
 * Read-only EVM call via mirror node (free, no HBAR cost)
 * @param {string} env - Environment (TEST, MAIN, etc.)
 * @param {ContractId | string} contractId - Contract to call
 * @param {string} data - Encoded function call data
 * @param {AccountId | string} from - Caller address
 * @param {boolean} estimate - Whether to estimate gas (default true)
 * @param {number} gas - Gas limit (default 300_000)
 * @returns {string} Encoded result
 */
async function readOnlyEVMFromMirrorNode(env, contractId, data, from, estimate = true, gas = 300_000) {
	const { AccountId, ContractId } = require('@hashgraph/sdk');
	const baseUrl = getBaseURL(env);

	if (from instanceof AccountId) {
		from = from.toSolidityAddress();
	}

	if (contractId instanceof ContractId) {
		contractId = contractId.toSolidityAddress();
	}

	if (!contractId.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
		throw new Error(`Invalid contractId - must be a ContractId or EVM address [${contractId}]`);
	}

	if (!from.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
		throw new Error(`Invalid from address - must be an AccountId or EVM address [${from}]`);
	}

	const body = {
		'block': 'latest',
		'data': data,
		'estimate': estimate,
		'from': from,
		'gas': gas,
		'gasPrice': 100000000,
		'to': contractId,
		'value': 0,
	};

	const url = `${baseUrl}/api/v1/contracts/call`;
	const response = await axios.post(url, body);
	return response.data?.result;
}

/**
 * Deploy a contract using ContractCreateFlow
 * @param {Client} client - Hedera client
 * @param {string} bytecode - Contract bytecode
 * @param {number} gasLim - Gas limit (default 800_000)
 * @param {ContractFunctionParameters | null} params - Constructor parameters
 * @returns {[ContractId, string]} Contract ID and solidity address
 */
async function contractDeployFunction(client, bytecode, gasLim = 800_000, params = null) {
	const contractCreateTx = new ContractCreateFlow()
		.setBytecode(bytecode)
		.setGas(gasLim);

	if (params) contractCreateTx.setConstructorParameters(params);

	const contractCreateSubmit = await contractCreateTx.execute(client);
	const contractCreateRx = await contractCreateSubmit.getReceipt(client);
	const contractId = contractCreateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	return [contractId, contractAddress];
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
	parseError,
	parseErrorTransactionId,
	contractExecuteFunction,
	contractExecuteQuery,
	readOnlyEVMFromMirrorNode,
	contractDeployFunction,
};
