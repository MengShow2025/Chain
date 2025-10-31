import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchResult {
  type: 'block' | 'transaction' | 'address' | 'validator';
  id: string;
  title: string;
  subtitle?: string;
}

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // 模拟API搜索
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      } else {
        // 模拟搜索结果
        const mockResults: SearchResult[] = [];
        
        // 检查是否是区块高度
        if (/^\d+$/.test(searchQuery)) {
          mockResults.push({
            type: 'block',
            id: searchQuery,
            title: `Block #${searchQuery}`,
            subtitle: 'Block height'
          });
        }
        
        // 检查是否是交易哈希
        if (/^0x[a-fA-F0-9]{64}$/.test(searchQuery)) {
          mockResults.push({
            type: 'transaction',
            id: searchQuery,
            title: `${searchQuery.slice(0, 10)}...${searchQuery.slice(-8)}`,
            subtitle: 'Transaction hash'
          });
        }
        
        // 检查是否是地址
        if (/^0x[a-fA-F0-9]{40}$/.test(searchQuery)) {
          mockResults.push({
            type: 'address',
            id: searchQuery,
            title: `${searchQuery.slice(0, 10)}...${searchQuery.slice(-8)}`,
            subtitle: 'Address'
          });
        }
        
        // 模糊搜索验证节点
        if (searchQuery.toLowerCase().includes('validator') || searchQuery.toLowerCase().includes('node')) {
          mockResults.push({
            type: 'validator',
            id: 'validator-1',
            title: 'Validator Node #1',
            subtitle: 'Active validator'
          });
        }
        
        setResults(mockResults);
      }
      
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // 延迟搜索以避免过多API调用
    setTimeout(() => {
      if (value === query) {
        handleSearch(value);
      }
    }, 300);
  };
  
  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    
    // 根据结果类型导航到相应页面
    switch (result.type) {
      case 'block':
        window.location.href = `/block/${result.id}`;
        break;
      case 'transaction':
        window.location.href = `/tx/${result.id}`;
        break;
      case 'address':
        window.location.href = `/address/${result.id}`;
        break;
      case 'validator':
        window.location.href = `/validator/${result.id}`;
        break;
    }
  };
  
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };
  
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'block':
        return '🧱';
      case 'transaction':
        return '💸';
      case 'address':
        return '👤';
      case 'validator':
        return '🛡️';
      default:
        return '🔍';
    }
  };
  
  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search blocks, transactions, addresses, validators..."
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        
        {query && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {isSearching && (
          <div className="absolute inset-y-0 right-8 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}-${index}`}
              onClick={() => handleResultClick(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {result.title}
                  </p>
                  {result.subtitle && (
                    <p className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                    {result.type}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* No Results */}
      {showResults && results.length === 0 && query.trim() && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="px-4 py-6 text-center">
            <Search className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No results found for &quot;{query}&quot;</p>
            <p className="text-xs text-gray-400 mt-1">
              Try searching for block numbers, transaction hashes, or addresses
            </p>
          </div>
        </div>
      )}
    </div>
  );
};