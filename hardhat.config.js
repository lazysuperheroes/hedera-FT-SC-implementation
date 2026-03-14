/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	mocha: {
		timeout: 100_000_000,
		slow: 100_000,
	},
	solidity: {
		version: '0.8.18',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
};
