require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

// 默认私钥（仅用于本地开发）
const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY],
      chainId: 31337
    },
    titanchain: {
      url: process.env.TITANCHAIN_RPC_URL || "http://localhost:8545",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [DEFAULT_PRIVATE_KEY],
      chainId: 1001,
      gasPrice: 20000000000, // 20 gwei
      gas: 8000000
    },
    titanchain_testnet: {
      url: process.env.TITANCHAIN_TESTNET_RPC_URL || "https://testnet-rpc.titanchain.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [DEFAULT_PRIVATE_KEY],
      chainId: 1002,
      gasPrice: 10000000000, // 10 gwei
      gas: 8000000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};