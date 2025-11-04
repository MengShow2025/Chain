// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TitanStaking.sol";

/**
 * @title TitanMargin
 * @dev TitanChain保证金管理合约，支持杠杆交易和风险管理
 * 
 * 核心功能：
 * - 保证金账户管理 / Margin account management
 * - 杠杆交易支持 / Leverage trading support  
 * - 风险控制和强制平仓 / Risk control and liquidation
 * - VIP等级集成 / VIP level integration
 */
contract TitanMargin is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    // 引用质押合约获取VIP等级 / Reference staking contract for VIP levels
    TitanStaking public immutable stakingContract;
    
    // 保证金配置 / Margin configuration
    struct MarginConfig {
        uint256 initialMarginRate;      // 初始保证金率 (basis points) / Initial margin rate
        uint256 maintenanceMarginRate;  // 维持保证金率 (basis points) / Maintenance margin rate
        uint256 maxLeverage;            // 最大杠杆倍数 / Maximum leverage
        uint256 liquidationThreshold;   // 强制平仓阈值 (basis points) / Liquidation threshold
        uint256 marginCallThreshold;    // 保证金调用阈值 (basis points) / Margin call threshold
    }
    
    // VIP等级配置 / VIP level configuration
    struct VIPConfig {
        uint256 minStakeAmount;         // 最小质押量 / Minimum stake amount
        uint256 maxLeverage;            // 最大杠杆倍数 / Maximum leverage
        uint256 feeDiscount;            // 手续费折扣 (basis points) / Fee discount
        string name;                    // 等级名称 / Level name
    }
    
    // 保证金账户 / Margin account
    struct MarginAccount {
        mapping(address => uint256) balances;        // 资产余额 / Asset balances
        mapping(address => uint256) frozenBalances;  // 冻结余额 / Frozen balances
        uint256 totalEquity;                         // 总权益 / Total equity
        uint256 usedMargin;                          // 已用保证金 / Used margin
        uint256 availableMargin;                     // 可用保证金 / Available margin
        uint256 marginRatio;                         // 保证金率 / Margin ratio
        AccountStatus status;                        // 账户状态 / Account status
        uint256 vipLevel;                           // VIP等级 / VIP level
    }
    
    // 杠杆持仓 / Leverage position
    struct Position {
        address tradingPair;            // 交易对 / Trading pair
        bool isLong;                    // 是否做多 / Is long position
        uint256 quantity;               // 持仓数量 / Position quantity
        uint256 avgPrice;               // 平均开仓价格 / Average entry price
        int256 unrealizedPnl;           // 未实现盈亏 / Unrealized PnL
        int256 realizedPnl;             // 已实现盈亏 / Realized PnL
        uint256 margin;                 // 保证金 / Margin
        uint256 leverage;               // 杠杆倍数 / Leverage
        uint256 liquidationPrice;       // 强制平仓价格 / Liquidation price
        uint256 openTime;               // 开仓时间 / Open time
        bool isActive;                  // 是否活跃 / Is active
    }
    
    // 账户状态枚举 / Account status enum
    enum AccountStatus {
        Normal,         // 正常 / Normal
        MarginCall,     // 保证金调用 / Margin call
        Liquidation     // 强制平仓 / Liquidation
    }
    
    // 状态变量 / State variables
    MarginConfig public marginConfig;
    mapping(uint256 => VIPConfig) public vipConfigs;
    mapping(address => MarginAccount) public marginAccounts;
    mapping(address => mapping(uint256 => Position)) public positions;
    mapping(address => uint256) public positionCounts;
    mapping(address => bool) public supportedAssets;
    mapping(address => uint256) public assetPrices;
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_VIP_LEVEL = 5;
    uint256 public totalMarginAccounts;
    uint256 public totalActivePositions;
    
    // 事件 / Events
    event MarginAccountCreated(address indexed user, uint256 vipLevel);
    event MarginDeposited(address indexed user, address asset, uint256 amount);
    event MarginWithdrawn(address indexed user, address asset, uint256 amount);
    event PositionOpened(address indexed user, uint256 indexed positionId, address tradingPair, bool isLong, uint256 quantity, uint256 leverage);
    event PositionClosed(address indexed user, uint256 indexed positionId, int256 pnl);
    event MarginCallTriggered(address indexed user, uint256 marginRatio);
    event LiquidationExecuted(address indexed user, uint256 indexed positionId, uint256 liquidationPrice);
    event VIPLevelUpdated(address indexed user, uint256 oldLevel, uint256 newLevel);
    event AssetPriceUpdated(address indexed asset, uint256 newPrice);
    
    constructor(
        address _stakingContract
    ) {
        stakingContract = TitanStaking(_stakingContract);
        
        // 初始化默认保证金配置 / Initialize default margin config
        marginConfig = MarginConfig({
            initialMarginRate: 1000,        // 10%
            maintenanceMarginRate: 500,     // 5%
            maxLeverage: 10,                // 10x
            liquidationThreshold: 300,      // 3%
            marginCallThreshold: 700        // 7%
        });
        
        // 初始化VIP等级配置 / Initialize VIP level configs
        _initializeVIPConfigs();
    }
    
    /**
     * @dev 初始化VIP等级配置 / Initialize VIP level configurations
     */
    function _initializeVIPConfigs() private {
        // VIP 0: 普通用户 / Regular user
        vipConfigs[0] = VIPConfig({
            minStakeAmount: 0,
            maxLeverage: 5,
            feeDiscount: 0,
            name: "Regular"
        });
        
        // VIP 1: 青铜 / Bronze
        vipConfigs[1] = VIPConfig({
            minStakeAmount: 10000 * 10**18,  // 1万TTN
            maxLeverage: 10,
            feeDiscount: 500,  // 5%折扣
            name: "Bronze"
        });
        
        // VIP 2: 白银 / Silver
        vipConfigs[2] = VIPConfig({
            minStakeAmount: 50000 * 10**18,  // 5万TTN
            maxLeverage: 20,
            feeDiscount: 1000, // 10%折扣
            name: "Silver"
        });
        
        // VIP 3: 黄金 / Gold
        vipConfigs[3] = VIPConfig({
            minStakeAmount: 100000 * 10**18, // 10万TTN
            maxLeverage: 50,
            feeDiscount: 1500, // 15%折扣
            name: "Gold"
        });
        
        // VIP 4: 铂金 / Platinum
        vipConfigs[4] = VIPConfig({
            minStakeAmount: 500000 * 10**18, // 50万TTN
            maxLeverage: 75,
            feeDiscount: 2000, // 20%折扣
            name: "Platinum"
        });
        
        // VIP 5: 钻石 / Diamond
        vipConfigs[5] = VIPConfig({
            minStakeAmount: 1000000 * 10**18, // 100万TTN
            maxLeverage: 100,
            feeDiscount: 2500, // 25%折扣
            name: "Diamond"
        });
    }
    
    /**
     * @dev 创建保证金账户 / Create margin account
     */
    function createMarginAccount() external nonReentrant whenNotPaused {
        require(marginAccounts[msg.sender].status == AccountStatus(0) && 
                marginAccounts[msg.sender].totalEquity == 0, 
                "TitanMargin: account already exists");
        
        uint256 vipLevel = _calculateVIPLevel(msg.sender);
        
        MarginAccount storage account = marginAccounts[msg.sender];
        account.totalEquity = 0;
        account.usedMargin = 0;
        account.availableMargin = 0;
        account.marginRatio = 0;
        account.status = AccountStatus.Normal;
        account.vipLevel = vipLevel;
        
        totalMarginAccounts++;
        
        emit MarginAccountCreated(msg.sender, vipLevel);
    }
    
    /**
     * @dev 计算用户VIP等级 / Calculate user VIP level
     */
    function _calculateVIPLevel(address user) internal view returns (uint256) {
        (uint256 stakedAmount,,,) = stakingContract.stakeInfo(user);
        
        for (uint256 i = MAX_VIP_LEVEL; i > 0; i--) {
            if (stakedAmount >= vipConfigs[i].minStakeAmount) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * @dev 存入保证金 / Deposit margin
     */
    function depositMargin(address asset, uint256 amount) external nonReentrant whenNotPaused {
        require(supportedAssets[asset], "TitanMargin: asset not supported");
        require(amount > 0, "TitanMargin: invalid amount");
        
        MarginAccount storage account = marginAccounts[msg.sender];
        require(account.totalEquity > 0 || account.status != AccountStatus(0), "TitanMargin: account not created");
        
        // 转入资产 / Transfer asset
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        // 更新账户余额 / Update account balance
        account.balances[asset] += amount;
        
        // 重新计算权益和可用保证金 / Recalculate equity and available margin
        _updateAccountEquity(msg.sender);
        
        emit MarginDeposited(msg.sender, asset, amount);
    }
    
    /**
     * @dev 提取保证金 / Withdraw margin
     */
    function withdrawMargin(address asset, uint256 amount) external nonReentrant {
        require(supportedAssets[asset], "TitanMargin: asset not supported");
        require(amount > 0, "TitanMargin: invalid amount");
        
        MarginAccount storage account = marginAccounts[msg.sender];
        require(account.balances[asset] >= amount, "TitanMargin: insufficient balance");
        
        // 检查提取后是否满足保证金要求 / Check margin requirements after withdrawal
        uint256 assetValue = amount * assetPrices[asset] / 1e18;
        require(account.availableMargin >= assetValue, "TitanMargin: insufficient available margin");
        
        // 更新余额 / Update balance
        account.balances[asset] -= amount;
        
        // 重新计算权益 / Recalculate equity
        _updateAccountEquity(msg.sender);
        
        // 转出资产 / Transfer asset
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit MarginWithdrawn(msg.sender, asset, amount);
    }
    
    /**
     * @dev 开仓 / Open position
     */
    function openPosition(
        address tradingPair,
        bool isLong,
        uint256 quantity,
        uint256 leverage,
        uint256 price
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        MarginAccount storage account = marginAccounts[msg.sender];
        require(account.status == AccountStatus.Normal, "TitanMargin: account not in normal status");
        
        // 检查杠杆倍数限制 / Check leverage limits
        uint256 maxAllowedLeverage = vipConfigs[account.vipLevel].maxLeverage;
        require(leverage <= maxAllowedLeverage, "TitanMargin: leverage exceeds limit");
        require(leverage > 0, "TitanMargin: invalid leverage");
        
        // 计算所需保证金 / Calculate required margin
        uint256 positionValue = quantity * price / 1e18;
        uint256 requiredMargin = positionValue * marginConfig.initialMarginRate / BASIS_POINTS / leverage;
        
        require(account.availableMargin >= requiredMargin, "TitanMargin: insufficient margin");
        
        // 创建持仓 / Create position
        positionId = positionCounts[msg.sender]++;
        Position storage position = positions[msg.sender][positionId];
        
        position.tradingPair = tradingPair;
        position.isLong = isLong;
        position.quantity = quantity;
        position.avgPrice = price;
        position.unrealizedPnl = 0;
        position.realizedPnl = 0;
        position.margin = requiredMargin;
        position.leverage = leverage;
        position.liquidationPrice = _calculateLiquidationPrice(price, isLong, leverage);
        position.openTime = block.timestamp;
        position.isActive = true;
        
        // 更新账户保证金使用情况 / Update account margin usage
        account.usedMargin += requiredMargin;
        account.availableMargin -= requiredMargin;
        
        totalActivePositions++;
        
        emit PositionOpened(msg.sender, positionId, tradingPair, isLong, quantity, leverage);
    }
    
    /**
     * @dev 平仓 / Close position
     */
    function closePosition(uint256 positionId, uint256 currentPrice) external nonReentrant {
        Position storage position = positions[msg.sender][positionId];
        require(position.isActive, "TitanMargin: position not active");
        
        // 计算盈亏 / Calculate PnL
        int256 pnl = _calculatePnL(position, currentPrice);
        
        // 更新账户 / Update account
        MarginAccount storage account = marginAccounts[msg.sender];
        account.usedMargin -= position.margin;
        
        // 处理盈亏 / Handle PnL
        if (pnl > 0) {
            account.availableMargin += position.margin + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            if (loss < position.margin) {
                account.availableMargin += position.margin - loss;
            }
            // 如果亏损超过保证金，保证金归零 / If loss exceeds margin, margin becomes zero
        }
        
        // 关闭持仓 / Close position
        position.isActive = false;
        position.realizedPnl = pnl;
        
        totalActivePositions--;
        
        emit PositionClosed(msg.sender, positionId, pnl);
    }
    
    /**
     * @dev 计算强制平仓价格 / Calculate liquidation price
     */
    function _calculateLiquidationPrice(uint256 entryPrice, bool isLong, uint256 leverage) internal view returns (uint256) {
        uint256 liquidationRate = marginConfig.liquidationThreshold;
        uint256 priceChange = entryPrice * liquidationRate / BASIS_POINTS / leverage;
        
        if (isLong) {
            return entryPrice > priceChange ? entryPrice - priceChange : 0;
        } else {
            return entryPrice + priceChange;
        }
    }
    
    /**
     * @dev 计算盈亏 / Calculate PnL
     */
    function _calculatePnL(Position memory position, uint256 currentPrice) internal pure returns (int256) {
        int256 priceDiff;
        if (position.isLong) {
            priceDiff = int256(currentPrice) - int256(position.avgPrice);
        } else {
            priceDiff = int256(position.avgPrice) - int256(currentPrice);
        }
        
        return priceDiff * int256(position.quantity) / 1e18;
    }
    
    /**
     * @dev 更新账户权益 / Update account equity
     */
    function _updateAccountEquity(address user) internal {
        MarginAccount storage account = marginAccounts[user];
        uint256 totalValue = 0;
        
        // 计算所有资产价值 / Calculate total asset value
        // 这里简化处理，实际应该遍历所有支持的资产
        // Simplified here, should iterate through all supported assets in practice
        
        account.totalEquity = totalValue;
        account.availableMargin = totalValue > account.usedMargin ? totalValue - account.usedMargin : 0;
        
        // 计算保证金率 / Calculate margin ratio
        if (account.usedMargin > 0) {
            account.marginRatio = account.totalEquity * BASIS_POINTS / account.usedMargin;
        } else {
            account.marginRatio = BASIS_POINTS; // 100%
        }
    }
    
    /**
     * @dev 检查并执行强制平仓 / Check and execute liquidation
     */
    function checkLiquidation(address user, uint256 positionId) external {
        Position storage position = positions[user][positionId];
        require(position.isActive, "TitanMargin: position not active");
        
        MarginAccount storage account = marginAccounts[user];
        
        // 检查是否需要强制平仓 / Check if liquidation is needed
        if (account.marginRatio < marginConfig.liquidationThreshold) {
            // 执行强制平仓 / Execute liquidation
            position.isActive = false;
            account.status = AccountStatus.Liquidation;
            
            emit LiquidationExecuted(user, positionId, position.liquidationPrice);
        }
    }
    
    /**
     * @dev 更新VIP等级 / Update VIP level
     */
    function updateVIPLevel() external {
        uint256 oldLevel = marginAccounts[msg.sender].vipLevel;
        uint256 newLevel = _calculateVIPLevel(msg.sender);
        
        if (oldLevel != newLevel) {
            marginAccounts[msg.sender].vipLevel = newLevel;
            emit VIPLevelUpdated(msg.sender, oldLevel, newLevel);
        }
    }
    
    // 管理员函数 / Admin functions
    
    /**
     * @dev 添加支持的资产 / Add supported asset
     */
    function addSupportedAsset(address asset, uint256 initialPrice) external onlyOwner {
        supportedAssets[asset] = true;
        assetPrices[asset] = initialPrice;
    }
    
    /**
     * @dev 更新资产价格 / Update asset price
     */
    function updateAssetPrice(address asset, uint256 newPrice) external onlyOwner {
        require(supportedAssets[asset], "TitanMargin: asset not supported");
        assetPrices[asset] = newPrice;
        emit AssetPriceUpdated(asset, newPrice);
    }
    
    /**
     * @dev 更新保证金配置 / Update margin config
     */
    function updateMarginConfig(
        uint256 _initialMarginRate,
        uint256 _maintenanceMarginRate,
        uint256 _maxLeverage,
        uint256 _liquidationThreshold,
        uint256 _marginCallThreshold
    ) external onlyOwner {
        marginConfig.initialMarginRate = _initialMarginRate;
        marginConfig.maintenanceMarginRate = _maintenanceMarginRate;
        marginConfig.maxLeverage = _maxLeverage;
        marginConfig.liquidationThreshold = _liquidationThreshold;
        marginConfig.marginCallThreshold = _marginCallThreshold;
    }
    
    // 查询函数 / View functions
    
    /**
     * @dev 获取用户保证金账户信息 / Get user margin account info
     */
    function getMarginAccount(address user) external view returns (
        uint256 totalEquity,
        uint256 usedMargin,
        uint256 availableMargin,
        uint256 marginRatio,
        AccountStatus status,
        uint256 vipLevel
    ) {
        MarginAccount storage account = marginAccounts[user];
        return (
            account.totalEquity,
            account.usedMargin,
            account.availableMargin,
            account.marginRatio,
            account.status,
            account.vipLevel
        );
    }
    
    /**
     * @dev 获取持仓信息 / Get position info
     */
    function getPosition(address user, uint256 positionId) external view returns (
        address tradingPair,
        bool isLong,
        uint256 quantity,
        uint256 avgPrice,
        int256 unrealizedPnl,
        uint256 margin,
        uint256 leverage,
        uint256 liquidationPrice,
        bool isActive
    ) {
        Position storage position = positions[user][positionId];
        return (
            position.tradingPair,
            position.isLong,
            position.quantity,
            position.avgPrice,
            position.unrealizedPnl,
            position.margin,
            position.leverage,
            position.liquidationPrice,
            position.isActive
        );
    }
    
    /**
     * @dev 获取VIP配置 / Get VIP config
     */
    function getVIPConfig(uint256 level) external view returns (VIPConfig memory) {
        return vipConfigs[level];
    }
}