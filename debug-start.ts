import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('PORT:', process.env.PORT);

// 测试导入
try {
  console.log('Testing imports...');
  
  const { TitanChain } = await import('./blockchain/core/blockchain.js');
  console.log('✓ TitanChain imported successfully');
  
  const { ValidatorManager } = await import('./blockchain/consensus/validator-manager.js');
  console.log('✓ ValidatorManager imported successfully');
  
  console.log('Creating TitanChain instance...');
  const titanChain = new TitanChain();
  console.log('✓ TitanChain instance created successfully');
  
  console.log('All imports successful!');
  
} catch (error) {
  console.error('Import error:', error);
  process.exit(1);
}