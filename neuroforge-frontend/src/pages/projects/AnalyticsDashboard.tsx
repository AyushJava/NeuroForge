import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  BarChart3, TrendingUp, Clock, AlertTriangle,
  CheckCircle, Activity, Download, Loader2
} from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import analyticsService, { AnalyticsDashboardResponse, VelocityResponse, BurndownResponse, IssueTrendResponse, PortfolioHealthResponse } from '@/services/analyticsService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function StatCard({ label, value, icon: Icon, color, bg, trend }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg: string;
  trend?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color} mb-4`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.includes('+') ? 'text-green-400' : 'text-red-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-muted-foreground text-sm font-medium mb-1">{label}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { user, role } = useAuth();

  // For org-admin and project-manager, get organizations to filter analytics
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
    enabled: role === 'org-admin' || role === 'project-manager',
  });
  const orgs: Organization[] = orgsData?.data || [];
  
  // Use user's organizationId from JWT if available, otherwise fall back to most recent org
  const activeOrg = user?.organizationId 
    ? orgs.find(o => o.id === user.organizationId) || (orgs.length > 0 ? orgs[orgs.length - 1] : null)
    : (orgs.length > 0 ? orgs[orgs.length - 1] : null);

  // Use dashboard endpoint for all roles to get organization-scoped analytics
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', activeOrg?.id],
    queryFn: () => analyticsService.getDashboard(activeOrg?.id).then(r => r.data),
    enabled: !activeOrg || !!activeOrg.id,
  });

  const { data: velocityData } = useQuery({
    queryKey: ['velocity', activeOrg?.id],
    queryFn: () => analyticsService.getVelocity(activeOrg?.id).then(r => r.data),
    enabled: !activeOrg || !!activeOrg.id,
  });

  const { data: burndownData } = useQuery({
    queryKey: ['burndown', activeOrg?.id],
    queryFn: () => analyticsService.getBurndown(activeOrg?.id).then(r => r.data),
    enabled: !activeOrg || !!activeOrg.id,
  });

  const { data: issueTrendData } = useQuery({
    queryKey: ['issue-trend', activeOrg?.id],
    queryFn: () => analyticsService.getIssueTrend(activeOrg?.id).then(r => r.data),
    enabled: !activeOrg || !!activeOrg.id,
  });

  const stats: AnalyticsDashboardResponse | undefined = dashboardData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col">
          <DashboardNavbar title="Analytics Dashboard" />
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Analytics Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Track project performance, team velocity, and quality metrics
            </p>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              label="Total Tasks" 
              value={stats?.totalTasks ?? 0} 
              icon={CheckCircle} 
              color="text-blue-400" 
              bg="bg-blue-500/10" 
            />
            <StatCard 
              label="Completed Tasks" 
              value={stats?.completedTasks ?? 0} 
              icon={Activity} 
              color="text-emerald-400" 
              bg="bg-emerald-500/10" 
            />
            <StatCard 
              label="Completion Rate" 
              value={`${stats?.completionPercentage?.toFixed(1) ?? 0}%`} 
              icon={TrendingUp} 
              color="text-violet-400" 
              bg="bg-violet-500/10" 
            />
            <StatCard 
              label="Avg Cycle Time" 
              value={`${stats?.averageCycleTimeHours?.toFixed(1) ?? 0}h`} 
              icon={Clock} 
              color="text-amber-400" 
              bg="bg-amber-500/10" 
            />
          </div>

          {/* Story Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Story Points</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Story Points</span>
                  <span className="text-white font-medium">{stats?.totalStoryPoints ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed Story Points</span>
                  <span className="text-emerald-400 font-medium">{stats?.completedStoryPoints ?? 0}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats?.completionPercentage ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Code Review Issues</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Issues</span>
                  <span className="text-white font-medium">{stats?.totalIssues ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-400">High Severity</span>
                  <span className="text-white font-medium">{stats?.highIssues ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400">Medium Severity</span>
                  <span className="text-white font-medium">{stats?.mediumIssues ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-400">Low Severity</span>
                  <span className="text-white font-medium">{stats?.lowIssues ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deployment Metrics */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Deployment Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Successful Deployments</p>
                <p className="text-2xl font-bold text-emerald-400">{stats?.successfulDeployments ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">Production Attempts</p>
                <p className="text-2xl font-bold text-white">{stats?.productionDeploymentAttempts ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">Failed Deployments</p>
                <p className="text-2xl font-bold text-red-400">{stats?.failedProductionDeployments ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">Change Failure Rate</p>
                <p className="text-2xl font-bold text-amber-400">
                  {stats?.changeFailureRate ? `${(stats.changeFailureRate * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Velocity Chart */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Velocity Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={velocityData?.sprints || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="sprintName" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="completedStoryPoints" stroke="#3B82F6" strokeWidth={2} name="Story Points" />
                  <Line type="monotone" dataKey="completedTasks" stroke="#10B981" strokeWidth={2} name="Tasks" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Burndown Chart */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Burndown Chart</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={burndownData?.points || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="remainingStoryPoints" stroke="#EF4444" strokeWidth={2} name="Remaining" />
                  <Line type="monotone" dataKey="completedStoryPoints" stroke="#10B981" strokeWidth={2} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bug Trend Chart */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">Bug Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={issueTrendData?.points || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Bar dataKey="highIssues" fill="#EF4444" name="High Severity" />
                  <Bar dataKey="mediumIssues" fill="#F59E0B" name="Medium Severity" />
                  <Bar dataKey="lowIssues" fill="#3B82F6" name="Low Severity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                href="/project-manager/portfolio"
                className="flex items-center gap-3 p-4 bg-background rounded-lg hover:bg-white/5 transition-colors"
              >
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-white">Portfolio Health</span>
              </Link>
              {role === 'project-manager' && (
                <Link 
                  href="/project-manager/quality-trends"
                  className="flex items-center gap-3 p-4 bg-background rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Activity className="w-5 h-5 text-blue-400" />
                  <span className="text-white">View Quality Trends</span>
                </Link>
              )}
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch('http://localhost:8081/api/analytics/reports/dashboard/pdf', {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                      }
                    });
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `analytics-dashboard-${new Date().toISOString().split('T')[0]}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }
                  } catch (error) {
                    console.error('Failed to export PDF:', error);
                  }
                }}
                className="flex items-center gap-3 p-4 bg-background rounded-lg hover:bg-white/5 transition-colors"
              >
                <Download className="w-5 h-5 text-violet-400" />
                <span className="text-white">Export Report</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
