const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting TitanChain contract deployment...");
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    
    // 检查账户余额
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
    
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {}
    };
    
    try {
        // 1. 部署 TitanToken
        console.log("\n📦 Deploying TitanToken...");
        const TitanToken = await ethers.getContractFactory("TitanToken");
        const titanToken = await TitanToken.deploy();
        await titanToken.deployed();
        
        console.log("✅ TitanToken deployed to:", titanToken.address);
        deploymentInfo.contracts.TitanToken = {
            address: titanToken.address,
            constructorArgs: []
        };
        
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
        deploymentInfo.contracts.TitanStaking = {
            address: titanStaking.address,
            constructorArgs: [titanToken.address, titanToken.address, rewardPerSecond.toString(), lockDuration]
        };
        
        // 3. 配置合约
        console.log("\n⚙️ Configuring contracts...");
        
        // 添加质押合约为铸币者
        await titanToken.addMinter(titanStaking.address);
        console.log("✅ Added staking contract as minter");
        
        // 转移一些代币到质押合约作为奖励
        const rewardAmount = ethers.utils.parseEther("1000000"); // 100万代币
        await titanToken.transfer(titanStaking.address, rewardAmount);
        console.log("✅ Transferred reward tokens to staking contract");
        
        // 4. 保存部署信息
        const deploymentPath = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        const deploymentFile = path.join(deploymentPath, `${hre.network.name}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log("\n📋 Deployment Summary:");
        console.log("=".repeat(50));
        console.log(`Network: ${hre.network.name}`);
        console.log(`Deployer: ${deployer.address}`);
        console.log(`TitanToken: ${titanToken.address}`);
        console.log(`TitanStaking: ${titanStaking.address}`);
        console.log(`Deployment file: ${deploymentFile}`);
        console.log("=".repeat(50));
        
        // 5. 验证合约（如果不是本地网络）
        if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
            console.log("\n🔍 Verifying contracts...");
            await verifyContracts(deploymentInfo);
        }
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

async function verifyContracts(deploymentInfo) {
    try {
        // 验证 TitanToken
        await hre.run("verify:verify", {
            address: deploymentInfo.contracts.TitanToken.address,
            constructorArguments: deploymentInfo.contracts.TitanToken.constructorArgs
        });
        
        // 验证 TitanStaking
        await hre.run("verify:verify", {
            address: deploymentInfo.contracts.TitanStaking.address,
            constructorArguments: deploymentInfo.contracts.TitanStaking.constructorArgs
        });
        
        console.log("✅ Contracts verified successfully");
    } catch (error) {
        console.warn("⚠️ Contract verification failed:", error.message);
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