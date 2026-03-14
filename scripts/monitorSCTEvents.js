const { AccountId } = require('@hashgraph/sdk');
const cron = require('node-cron');
const axios = require('axios');
const { getContractConfig } = require('../utils/clientFactory');
const { loadInterface } = require('../utils/abiLoader');
const { getBaseURL } = require('../utils/hederaMirrorHelpers');
const { formatTokenAmount } = require('../utils/scriptHelpers');
require('dotenv').config();

const { contractId, contractName, tokenDecimals } = getContractConfig();
const env = process.env.ENVIRONMENT ?? null;

if (!contractId || !env) {
	console.log('ERROR: Must specify CONTRACT_ID and ENVIRONMENT in .env file');
	process.exit(1);
}

const baseUrl = getBaseURL(env);
const iface = loadInterface(contractName);

let lastProcessedBlocknumber = process.env.LAST_PROCESSED_BLOCKNUMBER
	? Number(process.env.LAST_PROCESSED_BLOCKNUMBER)
	: 0;

console.log(`\n-Using ENVIRONMENT: ${env}`);
console.log(`-Using Contract: ${contractId.toString()} (${contractId.toSolidityAddress()})`);
console.log(`-Mirror Node: ${baseUrl}`);
console.log('\n-Starting event monitor...\n');

// Poll for new events every 5 seconds
cron.schedule('*/5 * * * * *', () => {
	fetchNewEvents();
});

// Heartbeat every 30 minutes
cron.schedule('2 */30 * * * *', () => {
	console.log(`... heartbeat (last block: ${lastProcessedBlocknumber})`);
});

async function fetchNewEvents() {
	let url = `${baseUrl}/api/v1/contracts/${contractId.toString()}/results/logs?order=desc&limit=10`;
	let newBlocknumber = lastProcessedBlocknumber;

	while (url) {
		try {
			const response = await axios.get(url);
			const jsonResponse = response.data;

			const validLogs = jsonResponse.logs.filter(
				log => Number(log.block_number) > lastProcessedBlocknumber,
			);

			validLogs.forEach(log => {
				if (log.data === '0x') return;

				try {
					const event = iface.parseLog({ topics: log.topics, data: log.data });

					const amount = formatTokenAmount(Number(event.args.amount), tokenDecimals);
					const from = AccountId.fromEvmAddress(0, 0, event.args.fromAddress).toString();

					console.log(
						`Block: ${log.block_number}` +
						` | Tx: ${log.transaction_hash}` +
						` | ${event.args.msgType}` +
						` | ${from}` +
						` | ${amount}` +
						` | ${event.args.message}`,
					);
				}
				catch {
					// Skip unparseable logs
				}

				newBlocknumber = Math.max(Number(log.block_number), newBlocknumber);
			});

			// Paginate if all logs in this page were new
			if (validLogs.length === jsonResponse.logs.length && jsonResponse.links?.next) {
				url = baseUrl + jsonResponse.links.next;
			}
			else {
				url = null;
			}
		}
		catch (err) {
			console.error(new Date().toISOString(), 'Error fetching logs:', err.message);
			url = null;
		}
	}

	lastProcessedBlocknumber = newBlocknumber;
}
