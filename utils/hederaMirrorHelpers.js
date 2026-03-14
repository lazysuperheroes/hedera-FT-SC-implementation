/**
 * Hedera Mirror Node Helpers
 * Free read-only queries via the Hedera mirror node REST API
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const { AccountId } = require('@hashgraph/sdk');
const axios = require('axios');

/**
 * Get the mirror node base URL for the given environment
 * @param {string} env - Environment (TEST, MAIN, PREVIEW, LOCAL)
 * @returns {string} Base URL
 */
function getBaseURL(env) {
	if (env.toLowerCase() == 'test' || env.toLowerCase() == 'testnet') {
		return 'https://testnet.mirrornode.hedera.com';
	}
	else if (env.toLowerCase() == 'main' || env.toLowerCase() == 'mainnet') {
		return 'https://mainnet-public.mirrornode.hedera.com';
	}
	else if (env.toLowerCase() == 'preview' || env.toLowerCase() == 'previewnet') {
		return 'https://previewnet.mirrornode.hedera.com';
	}
	else if (env.toLowerCase() == 'local') {
		return 'http://localhost:8000';
	}
	else {
		throw new Error('ERROR: Must specify either MAIN, TEST, LOCAL or PREVIEW as environment');
	}
}

/**
 * Check token allowance via mirror node (free)
 * @param {string} env - Environment
 * @param {AccountId | string} userId - Token owner account
 * @param {TokenId | string} tokenId - Token to check
 * @param {AccountId | string} spenderId - Spender to check allowance for
 * @returns {number} Allowance amount (0 if not found)
 */
async function checkMirrorAllowance(env, userId, tokenId, spenderId) {
	const baseUrl = getBaseURL(env);
	const url = `${baseUrl}/api/v1/accounts/${userId.toString()}/allowances/tokens`;

	let rtnVal = 0;
	try {
		const response = await axios.get(url);
		const jsonResponse = response.data;

		jsonResponse.allowances.forEach(allowance => {
			if (allowance.spender == spenderId.toString() && allowance.token_id == tokenId.toString()) {
				rtnVal = Number(allowance.amount);
			}
		});
	}
	catch (err) {
		console.error('Error checking mirror allowance:', err.message);
	}

	return rtnVal;
}

/**
 * Check token balance via mirror node (free)
 * @param {string} env - Environment
 * @param {AccountId | string} accountId - Account to check
 * @param {TokenId | string} tokenId - Token to check balance for
 * @returns {{tokenBalance: number, hbarBalance: number}} Token and HBAR balances
 */
async function checkMirrorBalance(env, accountId, tokenId) {
	const baseUrl = getBaseURL(env);
	const url = `${baseUrl}/api/v1/accounts/${accountId.toString()}`;

	try {
		const response = await axios.get(url);
		const data = response.data;

		const hbarBalance = data.balance?.balance ?? 0;

		let tokenBalance = 0;
		if (tokenId) {
			const tokensUrl = `${baseUrl}/api/v1/accounts/${accountId.toString()}/tokens?token.id=${tokenId.toString()}`;
			const tokensResponse = await axios.get(tokensUrl);
			const tokens = tokensResponse.data?.tokens ?? [];

			for (const token of tokens) {
				if (token.token_id == tokenId.toString()) {
					tokenBalance = Number(token.balance);
					break;
				}
			}
		}

		return { tokenBalance, hbarBalance };
	}
	catch (err) {
		console.error('Error checking mirror balance:', err.message);
		return { tokenBalance: 0, hbarBalance: 0 };
	}
}

/**
 * Get token details from mirror node
 * @param {string} env - Environment
 * @param {TokenId | string} tokenId - Token to look up
 * @returns {Object | null} Token details or null
 */
async function getTokenDetails(env, tokenId) {
	const baseUrl = getBaseURL(env);
	const url = `${baseUrl}/api/v1/tokens/${tokenId.toString()}`;

	try {
		const response = await axios.get(url);
		return response.data;
	}
	catch (err) {
		console.error('Error getting token details:', err.message);
		return null;
	}
}

/**
 * Get contract info from mirror node (free, vs consensus ContractInfoQuery which costs HBAR)
 * @param {string} env - Environment
 * @param {ContractId | string} contractId - Contract to look up
 * @returns {Object | null} Contract details or null
 */
async function getContractInfo(env, contractId) {
	const baseUrl = getBaseURL(env);
	const url = `${baseUrl}/api/v1/contracts/${contractId.toString()}`;

	try {
		const response = await axios.get(url);
		return response.data;
	}
	catch (err) {
		console.error('Error getting contract info:', err.message);
		return null;
	}
}

/**
 * Get contract event logs from mirror node
 * @param {string} env - Environment
 * @param {ContractId | string} contractId - Contract to fetch logs for
 * @param {ethers.Interface | null} iface - Optional interface for event decoding
 * @param {number} limit - Max number of logs (default 100)
 * @returns {Array} Array of log entries (decoded if iface provided)
 */
async function getContractLogs(env, contractId, iface = null, limit = 100) {
	const baseUrl = getBaseURL(env);
	const url = `${baseUrl}/api/v1/contracts/${contractId.toString()}/results/logs?order=desc&limit=${limit}`;

	try {
		const response = await axios.get(url);
		const logs = response.data?.logs ?? [];

		if (!iface) return logs;

		// Decode logs using ethers Interface
		return logs.map(log => {
			try {
				const event = iface.parseLog({
					topics: log.topics,
					data: log.data,
				});
				return {
					...log,
					decoded: {
						name: event.name,
						args: event.args,
					},
				};
			}
			catch {
				return log;
			}
		});
	}
	catch (err) {
		console.error('Error fetching contract logs:', err.message);
		return [];
	}
}

/**
 * Parse the most recent event from mirror node logs
 * @param {string} env - Environment
 * @param {ContractId | string} contractId - Contract to check
 * @param {ethers.Interface} iface - Interface for decoding
 * @param {number} offset - Which arg index to return (default 0)
 * @param {boolean} isAccount - If true, convert result to AccountId
 * @returns {*} The decoded event argument value
 */
async function checkLastMirrorEvent(env, contractId, iface, offset = 0, isAccount = false) {
	const logs = await getContractLogs(env, contractId, iface, 1);

	if (logs.length === 0 || !logs[0].decoded) {
		return null;
	}

	const value = logs[0].decoded.args[offset];

	if (isAccount) {
		return AccountId.fromEvmAddress(0, 0, value);
	}

	return value;
}

module.exports = {
	getBaseURL,
	checkMirrorAllowance,
	checkMirrorBalance,
	getTokenDetails,
	getContractInfo,
	getContractLogs,
	checkLastMirrorEvent,
};
