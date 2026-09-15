import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

interface BurndownPoint {
  date: string;
  remainingStoryPoints: number;
}

interface Props {
  data: BurndownPoint[];
  isLoading?: boolean;
  sprintName?: string;
}

export default function SprintBurndownChart({ data, isLoading, sprintName }: Props) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 text-sm text-muted-foreground">
        No burndown data available for this sprint
      </div>
    );
  }

  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    points: point.remainingStoryPoints,
  }));

  const maxPoints = Math.max(...chartData.map(d => d.points), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {sprintName ? `Burndown: ${sprintName}` : 'Sprint Burndown'}
        </h4>
        <div className="text-xs text-muted-foreground">
          Remaining Story Points
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, maxPoints]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend 
            wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="points"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Story Points"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{data.length}</div>
          <div className="text-xs text-muted-foreground">Snapshots</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{data[0]?.remainingStoryPoints || 0}</div>
          <div className="text-xs text-muted-foreground">Starting Points</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{data[data.length - 1]?.remainingStoryPoints || 0}</div>
          <div className="text-xs text-muted-foreground">Current Points</div>
        </div>
      </div>
    </div>
  );
}
