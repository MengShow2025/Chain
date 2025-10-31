const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔗 Starting contract interaction demo...");
    
    // 读取部署信息
    const deploymentFile = path.join(__dirname, "../deployments", `${hre.network.name}.json`);
    if (!fs.existsSync(deploymentFile)) {
        console.error("❌ Deployment file not found. Please deploy contracts first.");
        process.exit(1);
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const [deployer, user1, user2] = await ethers.getSigners();
    
    console.log("👤 Deployer:", deployer.address);
    console.log("👤 User1:", user1.address);
    console.log("👤 User2:", user2.address);
    
    // 获取合约实例
    const TitanToken = await ethers.getContractFactory("TitanToken");
    const TitanStaking = await ethers.getContractFactory("TitanStaking");
    
    const titanToken = await ethers.getContractAt(
        "TitanToken",
        deploymentInfo.contracts.TitanToken.address
    );
    const titanStaking = await ethers.getContractAt(
        "TitanStaking", 
        deploymentInfo.contracts.TitanStaking.address
    );
    
    try {
        console.log("\n🔍 Contract Interaction Demo");
        console.log("=".repeat(50));
        
        // 1. 检查代币基本信息
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
        
        // 2. 转移一些代币给用户
        const transferAmount = ethers.utils.parseEther("10000"); // 10,000 TTN
        console.log("\n💸 Transferring tokens to users...");
        await titanToken.transfer(user1.address, transferAmount);
        await titanToken.transfer(user2.address, transferAmount);
        console.log(`✅ Transferred ${ethers.utils.formatEther(transferAmount)} TTN to each user`);
        
        // 3. 检查余额
        const user1Balance = await titanToken.balanceOf(user1.address);
        const user2Balance = await titanToken.balanceOf(user2.address);
        console.log(`💰 User1 balance: ${ethers.utils.formatEther(user1Balance)} TTN`);
        console.log(`💰 User2 balance: ${ethers.utils.formatEther(user2Balance)} TTN`);
        
        // 4. 用户1质押代币
        const stakeAmount = ethers.utils.parseEther("5000"); // 5,000 TTN
        console.log("\n✅ Approving staking contract...");
        await titanToken.connect(user1).approve(titanStaking.address, stakeAmount);
        
        console.log("🔒 User1 staking tokens...");
        await titanStaking.connect(user1).stake(stakeAmount);
        console.log(`✅ User1 staked ${ethers.utils.formatEther(stakeAmount)} TTN`);
        
        // 5. 检查质押信息
        const user1Info = await titanStaking.getUserInfo(user1.address);
        console.log("📊 User1 Staking Info:");
        console.log(`  Staked Amount: ${ethers.utils.formatEther(user1Info.stakedAmount)} TTN`);
        console.log(`  Pending Rewards: ${ethers.utils.formatEther(user1Info.pendingRewards)} TTN`);
        console.log(`  Lock End Time: ${new Date(user1Info.lockEndTime * 1000).toLocaleString()}`);
        console.log(`  Is Validator: ${user1Info.isValidator}`);
        
        // 6. 等待一段时间（模拟）
        console.log("\n⏳ Simulating time passage...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 7. 检查待领取奖励
        const pendingReward = await titanStaking.pendingReward(user1.address);
        console.log(`🎁 User1 pending reward: ${ethers.utils.formatEther(pendingReward)} TTN`);
        
        // 8. 用户1申请成为验证者（需要足够的质押量）
        const minValidatorStake = await titanStaking.MIN_VALIDATOR_STAKE();
        console.log(`🏛️ Minimum validator stake: ${ethers.utils.formatEther(minValidatorStake)} TTN`);
        
        if (user1Info.stakedAmount.gte(minValidatorStake)) {
            console.log("👑 User1 becoming validator...");
            await titanStaking.connect(user1).becomeValidator();
            console.log("✅ User1 is now a validator");
        } else {
            console.log("⚠️ User1 doesn't have enough stake to become validator");
        }
        
        // 9. 获取池信息
        const poolInfo = await titanStaking.getPoolInfo();
        console.log("\n📊 Pool Info:");
        console.log(`  Total Staked: ${ethers.utils.formatEther(poolInfo.totalStaked)} TTN`);
        console.log(`  Reward Per Second: ${ethers.utils.formatEther(poolInfo.rewardPerSecond)} TTN`);
        console.log(`  Lock Duration: ${poolInfo.lockDuration} seconds (${poolInfo.lockDuration / 86400} days)`);
        console.log(`  Min Stake Amount: ${ethers.utils.formatEther(poolInfo.minStakeAmount)} TTN`);
        
        console.log("\n✅ Contract interaction demo completed successfully!");
        
    } catch (error) {
        console.error("❌ Interaction failed:", error);
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