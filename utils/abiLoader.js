/**
 * Centralized ABI Loading with Caching
 * Eliminates duplicated ABI loading code across all scripts
 *
 * @author Lazy Super Heroes team (https://github.com/lazysuperheroes)
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Cache for loaded ABIs and interfaces
const abiCache = new Map();
const interfaceCache = new Map();

/**
 * Known contract names and their artifact paths
 * Used for quick lookup without specifying full path
 */
const KNOWN_CONTRACTS = {
	FungibleTokenCreator: 'contracts/FungibleTokenCreator.sol/FungibleTokenCreator.json',
};

/**
 * Resolves the full path to a contract artifact
 * @param {string} contractName - Name of the contract
 * @returns {string} Full path to the artifact JSON file
 */
function resolveArtifactPath(contractName) {
	// Check if it's a known contract
	if (KNOWN_CONTRACTS[contractName]) {
		return path.join(process.cwd(), 'artifacts', KNOWN_CONTRACTS[contractName]);
	}

	// Try standard Hardhat artifact path
	const standardPath = path.join(
		process.cwd(),
		'artifacts',
		'contracts',
		`${contractName}.sol`,
		`${contractName}.json`,
	);

	if (fs.existsSync(standardPath)) {
		return standardPath;
	}

	// Try looking in abi/ folder (for extracted ABIs)
	const abiPath = path.join(process.cwd(), 'abi', `${contractName}.json`);
	if (fs.existsSync(abiPath)) {
		return abiPath;
	}

	throw new Error(
		`Contract artifact not found for: ${contractName}\n` +
		'Run \'npx hardhat compile\' first, then retry.',
	);
}

/**
 * Loads contract ABI from artifacts
 * @param {string} contractName - Name of the contract (e.g., 'FungibleTokenCreator')
 * @returns {Array} The contract ABI
 */
function loadAbi(contractName) {
	if (abiCache.has(contractName)) {
		return abiCache.get(contractName);
	}

	const artifactPath = resolveArtifactPath(contractName);
	const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

	// Handle both full artifacts (with .abi property) and raw ABI files
	const abi = artifact.abi || artifact;

	abiCache.set(contractName, abi);
	return abi;
}

/**
 * Loads and creates an ethers.Interface for a contract
 * @param {string} contractName - Name of the contract
 * @returns {ethers.Interface} The contract interface
 */
function loadInterface(contractName) {
	if (interfaceCache.has(contractName)) {
		return interfaceCache.get(contractName);
	}

	const abi = loadAbi(contractName);
	const iface = new ethers.Interface(abi);

	interfaceCache.set(contractName, iface);
	return iface;
}

/**
 * Loads contract bytecode from artifacts
 * @param {string} contractName - Name of the contract
 * @returns {string} The contract bytecode
 */
function loadBytecode(contractName) {
	const artifactPath = resolveArtifactPath(contractName);
	const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

	if (!artifact.bytecode) {
		throw new Error(`Bytecode not found in artifact for: ${contractName}`);
	}

	return artifact.bytecode;
}

/**
 * Loads both ABI and Interface for a contract (convenience method)
 * @param {string} contractName - Name of the contract
 * @returns {{abi: Array, iface: ethers.Interface}} Both ABI and Interface
 */
function loadContract(contractName) {
	return {
		abi: loadAbi(contractName),
		iface: loadInterface(contractName),
	};
}

/**
 * Clears the ABI cache (useful for testing or hot-reloading)
 */
function clearCache() {
	abiCache.clear();
	interfaceCache.clear();
}

module.exports = {
	loadAbi,
	loadInterface,
	loadBytecode,
	loadContract,
	clearCache,
	KNOWN_CONTRACTS,
};
