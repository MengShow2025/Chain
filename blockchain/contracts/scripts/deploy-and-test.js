const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting TitanChain contract deployment and testing...");
    
    // 获取部署者账户
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("👤 User1:", user1.address);
    console.log("👤 User2:", user2.address);
    
    // 检查账户余额
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
    
    try {
        // 1. 部署 TitanToken
        console.log("\n📦 Deploying TitanToken...");
        const TitanToken = await ethers.getContractFactory("TitanToken");
        const titanToken = await TitanToken.deploy();
        await titanToken.deployed();
        
        console.log("✅ TitanToken deployed to:", titanToken.address);
        
        // 2. 部署 TitanStaking
        console.log("\n📦 Deploying TitanStaking...");
        const rewardPerSecond = ethers.utils.parseEther("1"); // 1 TTN per second
        const lockDuration = 7 * 24 * 60 * 60; // 7 days
        
        const TitanStaking = await ethers.getContractFactory("TitanStaking");
        const titanStaking = await TitanStaking.deploy(
            titanToken.address, // staking token
            titanToken.address, // reward token (same as staking token)
            rewardPerSecond,
            lockDuration
        );
        await titanStaking.deployed();
        
        console.log("✅ TitanStaking deployed to:", titanStaking.address);
        
        // 3. 配置合约
        console.log("\n⚙️ Configuring contracts...");
        
        // 添加质押合约为铸币者
        await titanToken.addMinter(titanStaking.address);
        console.log("✅ Added staking contract as minter");
        
        // 转移一些代币到质押合约作为奖励
        const rewardAmount = ethers.utils.parseEther("1000000"); // 100万代币
        await titanToken.transfer(titanStaking.address, rewardAmount);
        console.log("✅ Transferred reward tokens to staking contract");
        
        console.log("\n📋 Deployment Summary:");
        console.log("=".repeat(50));
        console.log(`TitanToken: ${titanToken.address}`);
        console.log(`TitanStaking: ${titanStaking.address}`);
        console.log("=".repeat(50));
        
        // 4. 开始测试
        console.log("\n🔍 Contract Testing Demo");
        console.log("=".repeat(50));
        
        // 检查代币基本信息
        const name = await titanToken.name();
        const symbol = await titanToken.symbol();
        const decimals = await titanToken.decimals();
        const totalSupply = await titanToken.totalSupply();
        const maxSupply = await titanToken.MAX_SUPPLY();
        const isPaused = await titanToken.paused();
        
        console.log("📊 Token Info:");
        console.log(`  Name: ${name}`);
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Decimals: ${decimals}`);
        console.log(`  Total Supply: ${ethers.utils.formatEther(totalSupply)} TTN`);
        console.log(`  Max Supply: ${ethers.utils.formatEther(maxSupply)} TTN`);
        console.log(`  Paused: ${isPaused}`);
        
        // 转移一些代币给用户
        const transferAmount = ethers.utils.parseEther("10000"); // 10,000 TTN
        console.log("\n💸 Transferring tokens to users...");
        await titanToken.transfer(user1.address, transferAmount);
        await titanToken.transfer(user2.address, transferAmount);
        console.log(`✅ Transferred ${ethers.utils.formatEther(transferAmount)} TTN to each user`);
        
        // 检查余额
        const user1Balance = await titanToken.balanceOf(user1.address);
        const user2Balance = await titanToken.balanceOf(user2.address);
        console.log(`💰 User1 balance: ${ethers.utils.formatEther(user1Balance)} TTN`);
        console.log(`💰 User2 balance: ${ethers.utils.formatEther(user2Balance)} TTN`);
        
        // 用户1质押代币
        const stakeAmount = ethers.utils.parseEther("5000"); // 5,000 TTN
        console.log("\n✅ Approving staking contract...");
        await titanToken.connect(user1).approve(titanStaking.address, stakeAmount);
        
        console.log("🔒 User1 staking tokens...");
        await titanStaking.connect(user1).stake(stakeAmount);
        console.log(`✅ User1 staked ${ethers.utils.formatEther(stakeAmount)} TTN`);
        
        // 检查质押信息
        const user1Info = await titanStaking.getUserInfo(user1.address);
        console.log("📊 User1 Staking Info:");
        console.log(`  Staked Amount: ${ethers.utils.formatEther(user1Info.stakedAmount)} TTN`);
        console.log(`  Pending Rewards: ${ethers.utils.formatEther(user1Info.pendingRewards)} TTN`);
        console.log(`  Lock End Time: ${new Date(user1Info.lockEndTime * 1000).toLocaleString()}`);
        console.log(`  Is Validator: ${user1Info.isValidator}`);
        
        // 检查待领取奖励
        const pendingReward = await titanStaking.pendingReward(user1.address);
        console.log(`🎁 User1 pending reward: ${ethers.utils.formatEther(pendingReward)} TTN`);
        
        // 用户1申请成为验证者（需要足够的质押量）
        const minValidatorStake = await titanStaking.MIN_VALIDATOR_STAKE();
        console.log(`🏛️ Minimum validator stake: ${ethers.utils.formatEther(minValidatorStake)} TTN`);
        
        if (user1Info.stakedAmount.gte(minValidatorStake)) {
            console.log("👑 User1 becoming validator...");
            await titanStaking.connect(user1).becomeValidator();
            console.log("✅ User1 is now a validator");
            
            // 重新检查用户信息
            const updatedUser1Info = await titanStaking.getUserInfo(user1.address);
            console.log(`✅ User1 validator status: ${updatedUser1Info.isValidator}`);
        } else {
            console.log("⚠️ User1 doesn't have enough stake to become validator");
        }
        
        // 获取池信息
        const poolInfo = await titanStaking.getPoolInfo();
        console.log("\n📊 Pool Info:");
        console.log(`  Total Staked: ${ethers.utils.formatEther(poolInfo.totalStaked)} TTN`);
        console.log(`  Reward Per Second: ${ethers.utils.formatEther(poolInfo.rewardPerSecond)} TTN`);
        console.log(`  Lock Duration: ${poolInfo.lockDuration} seconds (${poolInfo.lockDuration / 86400} days)`);
        console.log(`  Min Stake Amount: ${ethers.utils.formatEther(poolInfo.minStakeAmount)} TTN`);
        
        // 测试铸币功能
        console.log("\n🪙 Testing minting functionality...");
        const mintAmount = ethers.utils.parseEther("50000");
        await titanToken.mint(deployer.address, mintAmount);
        console.log(`✅ Minted ${ethers.utils.formatEther(mintAmount)} TTN to deployer`);
        
        const newTotalSupply = await titanToken.totalSupply();
        console.log(`📊 New total supply: ${ethers.utils.formatEther(newTotalSupply)} TTN`);
        
        console.log("\n✅ All tests completed successfully!");
        console.log("🎉 TitanChain smart contracts are working properly!");
        
    } catch (error) {
        console.error("❌ Deployment or testing failed:", error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };