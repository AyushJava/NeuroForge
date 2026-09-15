import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, CheckCircle, Download, Loader2, FolderKanban, Eye } from 'lucide-react';
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

export default function ClientAnalyticsDashboard() {
  const { user, role } = useAuth();

  // Get the most recent organization to filter analytics
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
    enabled: role === 'org-admin',
  });
  const orgs: Organization[] = orgsData?.data || [];
  const activeOrg = orgs.length > 0 ? orgs[orgs.length - 1] : null;

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['client-analytics-dashboard', activeOrg?.id],
    queryFn: () => analyticsService.getDashboard(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['client-velocity', activeOrg?.id],
    queryFn: () => analyticsService.getVelocity(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const { data: burndownData, isLoading: burndownLoading } = useQuery({
    queryKey: ['client-burndown', activeOrg?.id],
    queryFn: () => analyticsService.getBurndown(activeOrg?.id).then(r => r.data),
    enabled: role !== 'org-admin' || !!activeOrg?.id,
  });

  const dashboard = dashboardData;
  const velocity = velocityData;
  const burndown = burndownData;

  const isLoading = dashboardLoading || velocityLoading || burndownLoading;

  const handleExportReport = () => {
    if (dashboard) {
      const reportData = {
        generatedAt: new Date().toISOString(),
        generatedBy: user?.name || 'Client',
        dashboard: dashboard,
        velocity: velocity,
        burndown: burndown,
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-analytics-report-${new Date().toISOString().split('T')[0]}.json`;
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
        <DashboardNavbar title="Client Analytics Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Client Analytics Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Simplified project progress and delivery insights for {user?.name || 'Client'}.
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
                  label="Total Tasks"
                  value={dashboard?.totalTasks ?? 0}
                  icon={FolderKanban}
                  color="text-blue-400"
                  bg="bg-blue-500/10"
                />
                <StatCard
                  label="Completed"
                  value={dashboard?.completedTasks ?? 0}
                  icon={CheckCircle}
                  color="text-emerald-400"
                  bg="bg-emerald-500/10"
                />
                <StatCard
                  label="Remaining Tasks"
                  value={dashboard?.remainingTasks ?? 0}
                  icon={Clock}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                />
                <StatCard
                  label="Progress"
                  value={`${dashboard?.completionPercentage?.toFixed(1) ?? 0}%`}
                  icon={TrendingUp}
                  color="text-violet-400"
                  bg="bg-violet-500/10"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-white mb-4">Velocity Trend</h3>
                  {velocity?.sprints && velocity.sprints.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={velocity.sprints}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="sprintName" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="completedStoryPoints" stroke="#3b82f6" name="Story Points" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No velocity data available
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-white mb-4">Burndown Chart</h3>
                  {burndown?.points && burndown.points.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={burndown.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="remainingStoryPoints" stroke="#ef4444" name="Remaining Work" strokeWidth={2} />
                        <Line type="monotone" dataKey="completedStoryPoints" stroke="#22c55e" name="Completed" strokeDasharray="5 5" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No burndown data available
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-white mb-4">Project Status Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderKanban className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium text-white">Total Story Points</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.totalStoryPoints || 0}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm font-medium text-white">Completed Points</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.completedStoryPoints || 0}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Eye className="w-5 h-5 text-violet-400" />
                      <span className="text-sm font-medium text-white">Overall Progress</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {dashboard?.completionPercentage?.toFixed(1) || 0}%
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
