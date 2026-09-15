import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bug, ShieldCheck, AlertTriangle, CheckCircle, Clock, Download, Loader2 } from 'lucide-react';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';
import analyticsService from '@/services/analyticsService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color} mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-muted-foreground text-sm font-medium mb-1">{label}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function QAAnalyticsDashboard() {
  const { user, role } = useAuth();
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);

  // Get the most recent organization to filter analytics
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
    enabled: role === 'org-admin',
  });
  const orgs: Organization[] = orgsData?.data || [];
  const activeOrg = orgs.length > 0 ? orgs[orgs.length - 1] : null;

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['qa-dashboard', activeOrg?.id],
    queryFn: () => analyticsService.getDashboard(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const { data: issueTrendData, isLoading: issueTrendLoading } = useQuery({
    queryKey: ['qa-issue-trend', activeOrg?.id],
    queryFn: () => analyticsService.getIssueTrend(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const { data: taskDistributionData, isLoading: taskDistributionLoading } = useQuery({
    queryKey: ['qa-task-distribution', activeOrg?.id],
    queryFn: () => analyticsService.getTaskDistribution(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const dashboard = dashboardData;
  const issueTrend = issueTrendData;
  const taskDistribution = taskDistributionData;

  const isLoading = dashboardLoading || issueTrendLoading || taskDistributionLoading;

  const handleExportReport = () => {
    if (dashboard) {
      const reportData = {
        generatedAt: new Date().toISOString(),
        generatedBy: user?.name || 'QA',
        dashboard: dashboard,
        issueTrend: issueTrend,
        taskDistribution: taskDistribution,
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="QA Analytics Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">QA Analytics Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Quality metrics, bug trends, and testing coverage for {user?.name || 'QA'}.
              </p>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  label="Total Issues"
                  value={dashboard?.totalIssues ?? 0}
                  icon={ShieldCheck}
                  color="text-blue-400"
                  bg="bg-blue-500/10"
                />
                <StatCard
                  label="Completed Tasks"
                  value={dashboard?.completedTasks ?? 0}
                  icon={CheckCircle}
                  color="text-emerald-400"
                  bg="bg-emerald-500/10"
                />
                <StatCard
                  label="High Priority Issues"
                  value={dashboard?.highIssues ?? 0}
                  icon={Clock}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                />
                <StatCard
                  label="Completion Rate"
                  value={`${dashboard?.completionPercentage?.toFixed(1) ?? 0}%`}
                  icon={Bug}
                  color="text-violet-400"
                  bg="bg-violet-500/10"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-white mb-4">Bug/Issue Trend</h3>
                  {issueTrend?.points && issueTrend.points.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={issueTrend.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="bugs" stroke="#ef4444" name="Bugs" strokeWidth={2} />
                        <Line type="monotone" dataKey="issues" stroke="#f59e0b" name="Issues" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No issue trend data available
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-white mb-4">Task Distribution</h3>
                  {taskDistribution ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { status: 'TODO', count: taskDistribution.todo },
                        { status: 'IN_PROGRESS', count: taskDistribution.inProgress },
                        { status: 'CODE_REVIEW', count: taskDistribution.codeReview },
                        { status: 'TESTING', count: taskDistribution.testing },
                        { status: 'DONE', count: taskDistribution.done }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="status" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Bar dataKey="count" fill="#3b82f6" name="Task Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No task distribution data available
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Quality Metrics Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-medium text-white">High Priority Issues</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.highIssues || 0}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span className="text-sm font-medium text-white">Medium Issues</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.mediumIssues || 0}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm font-medium text-white">Total Issues</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.totalIssues || 0}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
