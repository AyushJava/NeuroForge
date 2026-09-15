import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building, FolderKanban, CheckCircle, TrendingUp, Download, Loader2 } from 'lucide-react';
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

export default function SuperAdminAnalyticsDashboard() {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then((r: any) => r.data),
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['super-admin-analytics-dashboard'],
    queryFn: () => analyticsService.getDashboard().then(r => r.data),
  });

  const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio-health', selectedOrgId],
    queryFn: () => selectedOrgId ? analyticsService.getPortfolioHealth(selectedOrgId).then(r => r.data) : Promise.resolve(null),
    enabled: !!selectedOrgId,
  });

  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['super-admin-velocity', selectedOrgId],
    queryFn: () => analyticsService.getVelocity(selectedOrgId ?? undefined).then(r => r.data),
  });

  const orgs: Organization[] = Array.isArray(orgsData?.data) ? orgsData.data : [];
  const dashboard = dashboardData;
  const portfolio = portfolioData;
  const velocity = velocityData;

  const isLoading = orgsLoading || dashboardLoading || portfolioLoading || velocityLoading;

  const handleExportReport = async () => {
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
        a.download = `super-admin-analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const healthDistribution = [
    { name: 'Healthy', value: portfolio?.healthyProjects || 0, color: '#22c55e' },
    { name: 'At Risk', value: portfolio?.atRiskProjects || 0, color: '#f59e0b' },
    { name: 'Critical', value: portfolio?.criticalProjects || 0, color: '#ef4444' },
  ].filter(item => item.value > 0);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <DashboardNavbar title="Super Admin Analytics Dashboard" />
        <main className="flex-1 p-8 overflow-y-auto">

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Super Admin Analytics Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Cross-organization portfolio health and platform-wide insights for {user?.name || 'Super Admin'}.
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
                  label="Organizations"
                  value={orgs.length}
                  icon={Building}
                  color="text-blue-400"
                  bg="bg-blue-500/10"
                />
                <StatCard
                  label="Total Tasks"
                  value={dashboard?.totalTasks ?? 0}
                  icon={FolderKanban}
                  color="text-violet-400"
                  bg="bg-violet-500/10"
                />
                <StatCard
                  label="Completed Tasks"
                  value={dashboard?.completedTasks ?? 0}
                  icon={CheckCircle}
                  color="text-emerald-400"
                  bg="bg-emerald-500/10"
                />
                <StatCard
                  label="Platform Progress"
                  value={`${dashboard?.completionPercentage?.toFixed(1) ?? 0}%`}
                  icon={TrendingUp}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                />
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Organization Portfolio Health</h3>
                <div className="mb-4">
                  <select
                    value={selectedOrgId || ''}
                    onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : null)}
                    className="bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Organization</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                {portfolioLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : portfolio ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      {healthDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={healthDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {healthDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                          No health data available for this organization
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Projects</span>
                          <span className="text-lg font-bold text-white">{portfolio.totalProjects ?? 0}</span>
                        </div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-emerald-400">Healthy Projects</span>
                          <span className="text-lg font-bold text-emerald-400">{portfolio.healthyProjects ?? 0}</span>
                        </div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-amber-400">At Risk Projects</span>
                          <span className="text-lg font-bold text-amber-400">{portfolio.atRiskProjects ?? 0}</span>
                        </div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-400">Critical Projects</span>
                          <span className="text-lg font-bold text-red-400">{portfolio.criticalProjects ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Select an organization to view portfolio health
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Platform Velocity Trend</h3>
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
                <h3 className="text-lg font-semibold text-white mb-4">Organization Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orgs.map((org) => (
                    <div key={org.id} className="bg-background/50 rounded-lg p-4 hover:bg-white/5 transition-colors cursor-pointer"
                         onClick={() => setSelectedOrgId(org.id)}>
                      <div className="flex items-center gap-3 mb-2">
                        <Building className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium text-white">{org.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">ID: {org.id}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
