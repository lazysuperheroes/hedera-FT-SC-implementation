/**
 * Hedera Token Service Helpers
 * Common HTS operations: account creation, token association, transfers
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const {
	AccountCreateTransaction,
	Hbar,
	TokenAssociateTransaction,
	TransferTransaction,
	AccountInfoQuery,
	ContractInfoQuery,
} = require('@hashgraph/sdk');

/**
 * Creates a new Hedera account with an initial balance
 * @param {Client} client - Hedera client
 * @param {PrivateKey} privateKey - Private key for the new account
 * @param {number} initialBalance - Initial HBAR balance
 * @returns {AccountId} The new account ID
 */
async function accountCreator(client, privateKey, initialBalance) {
	const response = await new AccountCreateTransaction()
		.setInitialBalance(new Hbar(initialBalance))
		.setKey(privateKey.publicKey)
		.execute(client);

	const receipt = await response.getReceipt(client);
	return receipt.accountId;
}

/**
 * Associates a token with an account (required before receiving tokens on Hedera)
 * @param {Client} client - Hedera client
 * @param {AccountId} accountId - Account to associate
 * @param {PrivateKey} accountKey - Private key of the account
 * @param {TokenId} tokenId - Token to associate
 * @returns {string} Status of the association
 */
async function associateTokenToAccount(client, accountId, accountKey, tokenId) {
	const transaction = await new TokenAssociateTransaction()
		.setAccountId(accountId)
		.setTokenIds([tokenId])
		.freezeWith(client)
		.sign(accountKey);

	const response = await transaction.execute(client);
	const receipt = await response.getReceipt(client);
	return receipt.status.toString();
}

/**
 * Transfer HBAR between accounts
 * @param {Client} client - Hedera client
 * @param {AccountId} sender - Sender account ID
 * @param {AccountId} receiver - Receiver account ID
 * @param {number} amount - Amount in HBAR
 * @param {PrivateKey} senderKey - Sender's private key (if different from operator)
 * @returns {string} Transaction status
 */
async function hbarTransfer(client, sender, receiver, amount, senderKey = null) {
	const tx = new TransferTransaction()
		.addHbarTransfer(sender, new Hbar(-amount))
		.addHbarTransfer(receiver, new Hbar(amount));

	if (senderKey) {
		tx.freezeWith(client);
		await tx.sign(senderKey);
	}

	const response = await tx.execute(client);
	const receipt = await response.getReceipt(client);
	return receipt.status.toString();
}

/**
 * Get account balance (token + HBAR) via consensus query
 * @param {Client} client - Hedera client
 * @param {AccountId} accountId - Account to check
 * @param {TokenId} tokenId - Token to check balance for
 * @param {number} tokenDecimal - Token decimal places
 * @returns {[number, Hbar]} Token balance (adjusted for decimals) and HBAR balance
 */
async function getAccountBalance(client, accountId, tokenId, tokenDecimal = 0) {
	const query = new AccountInfoQuery()
		.setAccountId(accountId);

	const info = await query.execute(client);

	let balance;
	const tokenMap = info.tokenRelationships;
	try {
		if (tokenMap) {
			balance = tokenMap.get(tokenId.toString()).balance * (10 ** -tokenDecimal);
		}
		else {
			balance = -1;
		}
	}
	catch {
		balance = -1;
	}

	return [balance, info.balance];
}

/**
 * Get contract balance (token + HBAR) via consensus query
 * @param {Client} client - Hedera client
 * @param {ContractId} contractId - Contract to check
 * @param {TokenId} tokenId - Token to check balance for
 * @param {number} tokenDecimal - Token decimal places
 * @returns {[number, Hbar]} Token balance (adjusted for decimals) and HBAR balance
 */
async function getContractBalance(client, contractId, tokenId, tokenDecimal = 0) {
	const query = new ContractInfoQuery()
		.setContractId(contractId);

	const info = await query.execute(client);

	let balance;
	const tokenMap = info.tokenRelationships;
	try {
		if (tokenMap) {
			balance = tokenMap.get(tokenId.toString()).balance * (10 ** -tokenDecimal);
		}
		else {
			balance = -1;
		}
	}
	catch {
		balance = -1;
	}

	return [balance, info.balance];
}

module.exports = {
	accountCreator,
	associateTokenToAccount,
	hbarTransfer,
	getAccountBalance,
	getContractBalance,
};
