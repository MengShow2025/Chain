// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TitanToken
 * @dev TitanChain生态系统的原生代币
 */
contract TitanToken is ERC20, ERC20Burnable, Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 10亿代币
    
    mapping(address => bool) public minters;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "TitanToken: caller is not a minter");
        _;
    }
    
    constructor() ERC20("TitanToken", "TTN") {
        // 初始铸造1000万代币给部署者
        _mint(msg.sender, 10000000 * 10**18);
    }
    
    /**
     * @dev 添加铸币者
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "TitanToken: minter is the zero address");
        require(!minters[minter], "TitanToken: minter already exists");
        
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev 移除铸币者
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "TitanToken: minter does not exist");
        
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev 铸造代币
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "TitanToken: mint to the zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "TitanToken: exceeds max supply");
        
        _mint(to, amount);
    }
    
    /**
     * @dev 批量铸造代币
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyMinter {
        require(recipients.length == amounts.length, "TitanToken: arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "TitanToken: exceeds max supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "TitanToken: mint to the zero address");
            _mint(recipients[i], amounts[i]);
        }
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
    
    /**
     * @dev 重写转账函数以支持暂停功能
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        require(!paused(), "TitanToken: token transfer while paused");
    }
    
    /**
     * @dev 获取代币信息
     */
    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        uint256 tokenMaxSupply,
        bool tokenPaused
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            paused()
        );
    }
}