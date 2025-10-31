// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TitanStaking
 * @dev TitanChain质押合约，支持代币质押和奖励分发
 */
contract TitanStaking is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    // 质押信息结构
    struct StakeInfo {
        uint256 amount;           // 质押数量
        uint256 rewardDebt;       // 奖励债务
        uint256 lastStakeTime;    // 最后质押时间
        uint256 lockEndTime;      // 锁定结束时间
    }
    
    // 质押池信息
    struct PoolInfo {
        uint256 totalStaked;      // 总质押量
        uint256 accRewardPerShare; // 累积每股奖励
        uint256 lastRewardTime;   // 最后奖励时间
        uint256 rewardPerSecond;  // 每秒奖励
        uint256 lockDuration;     // 锁定期（秒）
        uint256 minStakeAmount;   // 最小质押量
    }
    
    PoolInfo public poolInfo;
    mapping(address => StakeInfo) public stakeInfo;
    
    // 验证者相关
    mapping(address => bool) public validators;
    mapping(address => uint256) public validatorStakes;
    uint256 public constant MIN_VALIDATOR_STAKE = 100000 * 10**18; // 10万代币
    uint256 public totalValidatorStakes;
    
    // 事件
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event ValidatorAdded(address indexed validator, uint256 stake);
    event ValidatorRemoved(address indexed validator, uint256 stake);
    event PoolUpdated(uint256 rewardPerSecond, uint256 lockDuration);
    
    constructor(
        IERC20 _stakingToken,
        IERC20 _rewardToken,
        uint256 _rewardPerSecond,
        uint256 _lockDuration
    ) {
        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
        
        poolInfo = PoolInfo({
            totalStaked: 0,
            accRewardPerShare: 0,
            lastRewardTime: block.timestamp,
            rewardPerSecond: _rewardPerSecond,
            lockDuration: _lockDuration,
            minStakeAmount: 1000 * 10**18 // 1000代币最小质押
        });
    }
    
    /**
     * @dev 更新奖励池
     */
    function updatePool() public {
        if (block.timestamp <= poolInfo.lastRewardTime) {
            return;
        }
        
        if (poolInfo.totalStaked == 0) {
            poolInfo.lastRewardTime = block.timestamp;
            return;
        }
        
        uint256 timeElapsed = block.timestamp - poolInfo.lastRewardTime;
        uint256 reward = timeElapsed * poolInfo.rewardPerSecond;
        
        poolInfo.accRewardPerShare += (reward * 1e12) / poolInfo.totalStaked;
        poolInfo.lastRewardTime = block.timestamp;
    }
    
    /**
     * @dev 质押代币
     */
    function stake(uint256 _amount) external nonReentrant whenNotPaused {
        require(_amount >= poolInfo.minStakeAmount, "TitanStaking: amount below minimum");
        
        updatePool();
        
        StakeInfo storage user = stakeInfo[msg.sender];
        
        // 如果用户已有质押，先领取奖励
        if (user.amount > 0) {
            uint256 pending = (user.amount * poolInfo.accRewardPerShare) / 1e12 - user.rewardDebt;
            if (pending > 0) {
                rewardToken.safeTransfer(msg.sender, pending);
                emit RewardClaimed(msg.sender, pending);
            }
        }
        
        // 转入质押代币
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // 更新用户信息
        user.amount += _amount;
        user.lastStakeTime = block.timestamp;
        user.lockEndTime = block.timestamp + poolInfo.lockDuration;
        user.rewardDebt = (user.amount * poolInfo.accRewardPerShare) / 1e12;
        
        // 更新池信息
        poolInfo.totalStaked += _amount;
        
        emit Staked(msg.sender, _amount);
    }
    
    /**
     * @dev 取消质押
     */
    function unstake(uint256 _amount) external nonReentrant {
        StakeInfo storage user = stakeInfo[msg.sender];
        require(user.amount >= _amount, "TitanStaking: insufficient staked amount");
        require(block.timestamp >= user.lockEndTime, "TitanStaking: still in lock period");
        
        updatePool();
        
        // 计算并发放奖励
        uint256 pending = (user.amount * poolInfo.accRewardPerShare) / 1e12 - user.rewardDebt;
        if (pending > 0) {
            rewardToken.safeTransfer(msg.sender, pending);
            emit RewardClaimed(msg.sender, pending);
        }
        
        // 更新用户信息
        user.amount -= _amount;
        user.rewardDebt = (user.amount * poolInfo.accRewardPerShare) / 1e12;
        
        // 更新池信息
        poolInfo.totalStaked -= _amount;
        
        // 如果是验证者且质押量不足，移除验证者身份
        if (validators[msg.sender] && user.amount < MIN_VALIDATOR_STAKE) {
            _removeValidator(msg.sender);
        }
        
        // 转出代币
        stakingToken.safeTransfer(msg.sender, _amount);
        
        emit Unstaked(msg.sender, _amount);
    }
    
    /**
     * @dev 领取奖励
     */
    function claimReward() external nonReentrant {
        updatePool();
        
        StakeInfo storage user = stakeInfo[msg.sender];
        uint256 pending = (user.amount * poolInfo.accRewardPerShare) / 1e12 - user.rewardDebt;
        
        require(pending > 0, "TitanStaking: no pending reward");
        
        user.rewardDebt = (user.amount * poolInfo.accRewardPerShare) / 1e12;
        rewardToken.safeTransfer(msg.sender, pending);
        
        emit RewardClaimed(msg.sender, pending);
    }
    
    /**
     * @dev 申请成为验证者
     */
    function becomeValidator() external {
        require(!validators[msg.sender], "TitanStaking: already a validator");
        require(stakeInfo[msg.sender].amount >= MIN_VALIDATOR_STAKE, "TitanStaking: insufficient stake for validator");
        
        validators[msg.sender] = true;
        validatorStakes[msg.sender] = stakeInfo[msg.sender].amount;
        totalValidatorStakes += stakeInfo[msg.sender].amount;
        
        emit ValidatorAdded(msg.sender, stakeInfo[msg.sender].amount);
    }
    
    /**
     * @dev 退出验证者
     */
    function exitValidator() external {
        require(validators[msg.sender], "TitanStaking: not a validator");
        
        _removeValidator(msg.sender);
    }
    
    /**
     * @dev 内部函数：移除验证者
     */
    function _removeValidator(address validator) internal {
        if (validators[validator]) {
            validators[validator] = false;
            totalValidatorStakes -= validatorStakes[validator];
            validatorStakes[validator] = 0;
            
            emit ValidatorRemoved(validator, stakeInfo[validator].amount);
        }
    }
    
    /**
     * @dev 获取待领取奖励
     */
    function pendingReward(address _user) external view returns (uint256) {
        StakeInfo memory user = stakeInfo[_user];
        uint256 accRewardPerShare = poolInfo.accRewardPerShare;
        
        if (block.timestamp > poolInfo.lastRewardTime && poolInfo.totalStaked != 0) {
            uint256 timeElapsed = block.timestamp - poolInfo.lastRewardTime;
            uint256 reward = timeElapsed * poolInfo.rewardPerSecond;
            accRewardPerShare += (reward * 1e12) / poolInfo.totalStaked;
        }
        
        return (user.amount * accRewardPerShare) / 1e12 - user.rewardDebt;
    }
    
    /**
     * @dev 获取用户信息
     */
    function getUserInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 lockEndTime,
        bool isValidator,
        uint256 validatorStake
    ) {
        StakeInfo memory user = stakeInfo[_user];
        return (
            user.amount,
            this.pendingReward(_user),
            user.lockEndTime,
            validators[_user],
            validatorStakes[_user]
        );
    }
    
    /**
     * @dev 获取池信息
     */
    function getPoolInfo() external view returns (
        uint256 totalStaked,
        uint256 rewardPerSecond,
        uint256 lockDuration,
        uint256 minStakeAmount,
        uint256 totalValidators
    ) {
        uint256 validatorCount = 0;
        // 注意：这里简化了验证者计数，实际应用中可能需要维护一个验证者列表
        return (
            poolInfo.totalStaked,
            poolInfo.rewardPerSecond,
            poolInfo.lockDuration,
            poolInfo.minStakeAmount,
            validatorCount
        );
    }
    
    // 管理员函数
    
    /**
     * @dev 更新奖励参数
     */
    function updateRewardParams(uint256 _rewardPerSecond, uint256 _lockDuration) external onlyOwner {
        updatePool();
        poolInfo.rewardPerSecond = _rewardPerSecond;
        poolInfo.lockDuration = _lockDuration;
        
        emit PoolUpdated(_rewardPerSecond, _lockDuration);
    }
    
    /**
     * @dev 设置最小质押量
     */
    function setMinStakeAmount(uint256 _minStakeAmount) external onlyOwner {
        poolInfo.minStakeAmount = _minStakeAmount;
    }
    
    /**
     * @dev 紧急提取（仅限管理员）
     */
    function emergencyWithdraw(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}