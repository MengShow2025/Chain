import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建目录的辅助函数
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 基础模板文件
const templates = {
  wallet: {
    "title": "Wallet",
    "connect": {
      "title": "Connect Wallet",
      "subtitle": "Choose your preferred wallet to connect to TitanChain",
      "metamask": "MetaMask",
      "walletconnect": "WalletConnect",
      "coinbase": "Coinbase Wallet",
      "connecting": "Connecting...",
      "connected": "Connected",
      "failed": "Connection Failed",
      "retry": "Retry Connection"
    },
    "account": {
      "address": "Address",
      "balance": "Balance",
      "network": "Network",
      "disconnect": "Disconnect",
      "copy": "Copy Address",
      "viewOnExplorer": "View on Explorer"
    },
    "errors": {
      "walletNotInstalled": "Wallet not installed. Please install {{wallet}} extension.",
      "connectionRejected": "Connection rejected by user",
      "networkError": "Network connection error"
    }
  },
  explorer: {
    "title": "Blockchain Explorer",
    "search": {
      "placeholder": "Search by address, transaction hash, or block number",
      "button": "Search",
      "noResults": "No results found"
    },
    "blocks": {
      "title": "Latest Blocks",
      "height": "Block Height",
      "hash": "Block Hash",
      "timestamp": "Timestamp"
    }
  },
  staking: {
    "title": "Staking",
    "overview": {
      "totalStaked": "Total Staked",
      "myStake": "My Stake",
      "rewards": "Rewards",
      "apr": "Annual Percentage Rate"
    },
    "actions": {
      "stake": "Stake",
      "unstake": "Unstake",
      "claim": "Claim Rewards"
    }
  },
  governance: {
    "title": "Governance",
    "proposals": {
      "title": "Proposals",
      "active": "Active Proposals",
      "passed": "Passed Proposals",
      "create": "Create Proposal"
    },
    "voting": {
      "yes": "Yes",
      "no": "No",
      "abstain": "Abstain"
    }
  },
  validators: {
    "title": "Validators",
    "overview": {
      "totalValidators": "Total Validators",
      "activeValidators": "Active Validators",
      "totalStaked": "Total Staked"
    },
    "list": {
      "rank": "Rank",
      "validator": "Validator",
      "votingPower": "Voting Power"
    }
  }
};

// 语言配置
const languages = [
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' }
];

// 为每种语言创建文件
languages.forEach(lang => {
  const langDir = path.join(__dirname, '..', 'src', 'i18n', 'locales', lang.code);
  ensureDir(langDir);
  
  Object.keys(templates).forEach(namespace => {
    const filePath = path.join(langDir, `${namespace}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(templates[namespace], null, 2));
      console.log(`Created: ${filePath}`);
    }
  });
});

console.log('Language files generation completed!');