// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.12 <0.9.0;
// Compiled with Solidity 0.8.18

import {HederaResponseCodes} from "./HederaResponseCodes.sol";
import {HederaTokenService} from "./HederaTokenService.sol";
import {IHederaTokenService} from "./IHederaTokenService.sol";
import {ExpiryHelper} from "./ExpiryHelper.sol";
import {KeyHelper} from "./KeyHelper.sol";

// Import Ownable from the OpenZeppelin Contracts library
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// Expiry Helper extends FeeHelper which extends KeyHelper inherits HederaTokenService
// Ownable from OZ to limit access control

contract FungibleTokenCreator is KeyHelper, ExpiryHelper, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // List of trusted addresses which can mint tokens
    EnumerableSet.AddressSet private _allowanceWL;

    event TokenControllerMessage(
        string msgType,
        address indexed fromAddress,
        int64 amount,
        string message
    );

    // Create a fungible token with a WIPE key only (enables user self-burn / deflationary model)
    // No admin, supply, pause, freeze, KYC, or fee schedule keys
    /// @param name token name
    /// @param symbol token symbol
    /// @param memo token longer form description as a string
    /// @param initialSupply number of tokens to mint
    /// @param decimals decimal for the token -> 100 of the token divisible to 1dp will be 1000 supply with decimal 1
    /// @param maxSupply Set to 0 for an infinite token, set > 0 to enforce capped supply @ maxSupply
    /// @return createdTokenAddress the address of the new token
    function createFungibleWithBurn(
        string memory name,
        string memory symbol,
        string memory memo,
        int64 initialSupply,
        int32 decimals,
        int64 maxSupply
    )
		external
		payable
		onlyOwner
	returns (address createdTokenAddress) {
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);

        keys[0] = getSingleKey(KeyType.WIPE, KeyValueType.CONTRACT_ID, address(this));

        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.memo = memo;
        token.treasury = address(this);
        token.tokenKeys = keys;

        if (maxSupply > 0) {
            token.tokenSupplyType = true;
            token.maxSupply = maxSupply;
        }

        token.expiry = createAutoRenewExpiry(
            address(this),
            HederaTokenService.defaultAutoRenewPeriod
        );

        (int responseCode, address tokenAddress) = HederaTokenService
            .createFungibleToken(token, initialSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("mint with wipe key failed");
        }

        emit TokenControllerMessage(
            "MINT",
            msg.sender,
            initialSupply,
            "Minted with wipe key (burn enabled)"
        );

        createdTokenAddress = tokenAddress;
    }

    // Create a fungible token with WIPE + SUPPLY keys (enables burn + re-mint)
    // No admin key, no pause key
    /// @param name token name
    /// @param symbol token symbol
    /// @param memo token longer form description as a string
    /// @param initialSupply number of tokens to mint
    /// @param decimals decimal for the token -> 100 of the token divisible to 1dp will be 1000 supply with decimal 1
    /// @param maxSupply Set to 0 for an infinite token, set > 0 to enforce capped supply @ maxSupply
    /// @return createdTokenAddress the address of the new token
    function createFungibleWithSupplyAndBurn(
        string memory name,
        string memory symbol,
        string memory memo,
        int64 initialSupply,
        int32 decimals,
        int64 maxSupply
    )
		external
		payable
		onlyOwner
	returns (address createdTokenAddress) {
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);

        // Combine WIPE + SUPPLY into a single key entry
        keys[0] = getSingleKey(KeyType.WIPE, KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));

        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.memo = memo;
        token.treasury = address(this);
        token.tokenKeys = keys;

        if (maxSupply > 0) {
            token.tokenSupplyType = true;
            token.maxSupply = maxSupply;
        }

        token.expiry = createAutoRenewExpiry(
            address(this),
            HederaTokenService.defaultAutoRenewPeriod
        );

        (int responseCode, address tokenAddress) = HederaTokenService
            .createFungibleToken(token, initialSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("mint with wipe/supply keys failed");
        }

        emit TokenControllerMessage(
            "MINT",
            msg.sender,
            initialSupply,
            "Minted with supply + wipe keys (burn + re-mint enabled)"
        );

        createdTokenAddress = tokenAddress;
    }

    // mint an FT with no keys - not adjustable, 1 time mint as clean and transparent as possible
    /// @param name token name
    /// @param symbol token symbol
    /// @param memo token longer form description as a string
    /// @param initialSupply number of tokens to mint
    /// @param decimals decimal for the token -> 100 of the token divisible to 1dp will be 1000 supply with decimal 1
    /// @param maxSupply Set to 0 for an infinite token, set > 0 to enforce capped supply @ maxSupply
    /// @return createdTokenAddress the address of the new token
    function createTokenWithNoKeys(
        string memory name,
        string memory symbol,
        string memory memo,
        int64 initialSupply,
        int32 decimals,
        int64 maxSupply
    )
		external
		payable
		onlyOwner
	returns (address createdTokenAddress) {
        //define the token
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.memo = memo;
        token.treasury = address(this);

        if (maxSupply > 0) {
            token.tokenSupplyType = true;
            token.maxSupply = maxSupply;
        }

        // create the expiry schedule for the token using ExpiryHelper
        token.expiry = createAutoRenewExpiry(
            address(this),
            HederaTokenService.defaultAutoRenewPeriod
        );

        (int responseCode, address tokenAddress) = HederaTokenService
            .createFungibleToken(token, initialSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("mint no keys failed");
        }

        emit TokenControllerMessage(
            "MINT",
            msg.sender,
            initialSupply,
            "Success minting token without keys"
        );

        createdTokenAddress = tokenAddress;
    }

    /// Mint additional supply of a token (requires supply key)
    /// @param token address in EVM format of token to mint more supply to
    /// @param amount the number of new units to mint
    /// (inclusive of decimal e.g. 10 more of a decimal 1 token => amount = 100)
    /// @return responseCode result of the operation
    /// @return newTotalSupply new supply post mint
    function mintAdditionalSupply(address token, int64 amount)
        external
        onlyOwner
        returns (int responseCode, int64 newTotalSupply)
    {
        require(amount > 0, "Positive mint amounts only");
        bytes[] memory _metadata;

        (responseCode, newTotalSupply, ) = HederaTokenService.mintToken(
            token,
            amount,
            _metadata
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("mint supply failed");
        }

        emit TokenControllerMessage(
            "MINT ADDITIONAL",
            msg.sender,
            amount,
            "Additional supply minted"
        );
    }

    /// Burn tokens from the treasury (requires supply key)
    /// @param token address in EVM format of token to burn
    /// @param amount the number of units to burn from treasury
    /// @param _serials empty array for FT burns
    /// @return responseCode result of the operation
    /// @return newTotalSupply new supply post burn
    function burnFromTreasury(
        address token,
        int64 amount,
        int64[] memory _serials
    )
        external
        onlyOwner
        returns (int responseCode, int64 newTotalSupply)
    {
        require(amount > 0, "Positive burn amounts only");

        (responseCode, newTotalSupply) = HederaTokenService.burnToken(
            token,
            amount,
            _serials
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("burn from treasury failed");
        }

        emit TokenControllerMessage(
            "BURN",
            msg.sender,
            amount,
            "Burn (from treasury) complete"
        );
    }

    /// Burn tokens from the caller's own account (requires wipe key on token)
    /// This function is open to all -- callers can only burn tokens they own (msg.sender)
    /// @param token The token address
    /// @param amount The number of tokens to burn
    /// @return responseCode The response code for the status of the request. SUCCESS is 22.
    function burn(address token, int64 amount)
        external
        returns (int responseCode)
    {
        require(amount > 0, "Positive burn amounts only");

        (responseCode) = HederaTokenService.wipeTokenAccount(
            token,
            msg.sender,
            amount
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("burn failed");
        }

        emit TokenControllerMessage(
            "BURN",
            msg.sender,
            amount,
            "Burn (from user) complete"
        );
    }

    /// Batch transfer tokens to multiple recipients in a single transaction
    /// @param token The token address
    /// @param accountIds array of recipient addresses
    /// @param amounts array of amounts (must match accountIds length)
    function batchTransferTokens(
        address token,
        address[] memory accountIds,
        int64[] memory amounts
    )
		external
		onlyOwner
	returns (int responseCode) {
        (responseCode) = HederaTokenService.transferTokens(
            token,
            accountIds,
            amounts
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("batch transfer failed");
        }

        emit TokenControllerMessage(
            "Batch Transfer",
            msg.sender,
            0,
            "Batch transfer complete"
        );
    }

    /// Allows spender to withdraw from your account multiple times, up to the value amount. If this function is called
    /// again it overwrites the current allowance with value.
    /// Only Applicable to Fungible Tokens
    /// @param token The hedera token address to approve
    /// @param spender the account authorized to spend
    /// @param amount the amount of tokens authorized to spend.
    /// @return responseCode The response code for the status of the request. SUCCESS is 22.
    function approveAllowance(
        address token,
        address spender,
        uint256 amount
    ) external onlyOwner returns (int responseCode) {
        require(_allowanceWL.contains(spender), "Spender not on WL");

        (responseCode) = HederaTokenService.approve(token, spender, amount);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("allowance approval - failed");
        }

        emit TokenControllerMessage(
            "Approval",
            spender,
            SafeCast.toInt64(SafeCast.toInt256(amount)),
            "Allowance approved"
        );
    }

    /// Check the allowance for a specific user via an SC call [mirror node better?]
    /// @param token The Hedera token address to check the allowance of
    /// @param spender the spender of the tokens
    /// @return responseCode The response code for the status of the request. SUCCESS is 22.
    /// @return amount thw number of tokens authorised to spend
    function checkAllowance(address token, address spender)
        external
        returns (int responseCode, uint256 amount)
    {
        (responseCode, amount) = HederaTokenService.allowance(
            token,
            address(this),
            spender
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("getAllowance - failed");
        }

        emit TokenControllerMessage(
            "Allowance checked",
            spender,
            SafeCast.toInt64(SafeCast.toInt256(amount)),
            "checked"
        );
    }

    /// Use HTS to transfer FT
    /// @param token The token to transfer to/from
    /// @param receiver The receiver of the transaction
    /// @param amount Non-negative value to send. a negative value will result in a failure.
    function transferHTS(
        address token,
        address receiver,
        int64 amount
    )
		external
		onlyOwner
	returns (int responseCode) {
		require(amount > 0, "Positive transfers only");

        responseCode = HederaTokenService.transferToken(
            token,
            address(this),
            receiver,
            amount
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("transferHTS - failed");
        }

        emit TokenControllerMessage(
            "Transfer with HTS",
            receiver,
            amount,
            "completed"
        );
    }

    /// Transfer token from this contract to the recipient
    /// @param token address in EVM format of the token to transfer
    /// @param recipient address in EVM format of the receiver of the token
    /// @param amount number of tokens to send (in long form adjusted for decimal)
    /// @return sent a boolean signalling success
    function transfer(
        address token,
        address recipient,
        uint256 amount
    ) 
		external
		onlyOwner 
	returns (bool sent) {
        sent = IERC20(token).transfer(recipient, amount);
        require(sent, "Failed to transfer Tokens");

        emit TokenControllerMessage("Transfer", recipient, SafeCast.toInt64(SafeCast.toInt256(amount)), "complete");
    }


    // Transfer hbar out of the contract - using secure ether transfer pattern
    // Address.sendValue forwards all available gas; onlyOwner limits re-entrancy risk
    // Throws error on failure causing contract to automatically revert
    /// @param receiverAddress address in EVM format of the receiver of the hbar
    /// @param amount amount of hbar to send (in tinybar)
    function transferHbar(address payable receiverAddress, uint amount)
        external
        onlyOwner
    {
        // throws error on failure
        Address.sendValue(receiverAddress, amount);

        emit TokenControllerMessage(
            "Hbar Transfer",
            receiverAddress,
            SafeCast.toInt64(SafeCast.toInt256(amount)),
            "complete"
        );
    }

    // Add an address to the allowance WL
    /// @param newAddress the new address to add
    function addAllowanceWhitelist(address newAddress) external onlyOwner {
        _allowanceWL.add(newAddress);
        emit TokenControllerMessage(
            "ADD WL",
            newAddress,
            0,
            "allowance WL updated"
        );
    }

    // Remove an address from the allowance WL
    /// @param oldAddress the address to remove
    function removeAllowanceWhitelist(address oldAddress) external onlyOwner {
        _allowanceWL.remove(oldAddress);
        emit TokenControllerMessage(
            "REMOVE WL",
            oldAddress,
            0,
            "allowance WL updated"
        );
    }

    /// Check the current White List for Approvals
    /// @return wl an array of addresses currently enabled for allowance approval
    function getAllowanceWhitelist()
        external
        view
        returns (address[] memory wl)
    {
        return _allowanceWL.values();
    }

    // Check if the address is in the WL
    /// @param addressToCheck the address to check in WL
    /// @return bool if in the WL
    function isAddressWL(address addressToCheck) external view returns (bool) {
        return _allowanceWL.contains(addressToCheck);
    }

    // allows the contract to receive HBAR
    receive() external payable {
        emit TokenControllerMessage(
            "Receive",
            msg.sender,
            SafeCast.toInt64(SafeCast.toInt256(msg.value)),
            "Hbar received"
        );
    }

    fallback() external payable {
        emit TokenControllerMessage(
            "Fallback",
            msg.sender,
            SafeCast.toInt64(SafeCast.toInt256(msg.value)),
            "Hbar received"
        );
    }
}
