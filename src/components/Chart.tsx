/**
 * Chart Component / 图表组件
 * A reusable chart component for displaying various data visualizations
 * 用于显示各种数据可视化的可重用图表组件
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ChartData {
  timestamp: number;
  value: number;
  label?: string;
}

interface ChartProps {
  data?: ChartData[];
  type?: 'line' | 'area';
  color?: string;
  height?: number;
  title?: string;
  className?: string;
}

const Chart: React.FC<ChartProps> = ({
  data = [],
  type = 'line',
  color = '#3B82F6',
  height = 200,
  title,
  className = ''
}) => {
  // Generate sample data if no data provided / 如果没有提供数据则生成示例数据
  const sampleData = data.length > 0 ? data : [
    { timestamp: Date.now() - 6000, value: 100 },
    { timestamp: Date.now() - 5000, value: 120 },
    { timestamp: Date.now() - 4000, value: 110 },
    { timestamp: Date.now() - 3000, value: 140 },
    { timestamp: Date.now() - 2000, value: 130 },
    { timestamp: Date.now() - 1000, value: 160 },
    { timestamp: Date.now(), value: 150 }
  ];

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        {type === 'area' ? (
          <AreaChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#6B7280"
              fontSize={12}
            />
            <YAxis stroke="#6B7280" fontSize={12} />
            <Tooltip 
              labelFormatter={(value) => formatTime(value as number)}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        ) : (
          <LineChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#6B7280"
              fontSize={12}
            />
            <YAxis stroke="#6B7280" fontSize={12} />
            <Tooltip 
              labelFormatter={(value) => formatTime(value as number)}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;