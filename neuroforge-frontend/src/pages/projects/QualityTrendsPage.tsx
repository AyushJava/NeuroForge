import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Users, Loader2 } from 'lucide-react';
import { codeReviewService, QualityTrendResponse } from '@/services/codeReviewService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/common/Sidebar';
import DashboardNavbar from '@/components/common/DashboardNavbar';

export default function QualityTrendsPage() {
  const { user } = useAuth();
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>('all');

  // Get organizations to filter quality trends by active organization
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll().then(r => r.data),
  });
  const orgs: Organization[] = orgsData?.data || [];
  
  // Use user's organizationId from JWT if available, otherwise fall back to most recent org
  const activeOrg = user?.organizationId 
    ? orgs.find(o => o.id === user.organizationId) || (orgs.length > 0 ? orgs[orgs.length - 1] : null)
    : (orgs.length > 0 ? orgs[orgs.length - 1] : null);

  const { data: allTrends, isLoading } = useQuery({
    queryKey: ['quality-trends', activeOrg?.id],
    queryFn: () => codeReviewService.getQualityTrendsForAllDevelopers(activeOrg?.id),
    enabled: !activeOrg || !!activeOrg.id,
  });

  const selectedTrendData = selectedDeveloper === 'all' 
    ? allTrends 
    : allTrends?.filter((trend: QualityTrendResponse) => trend.developerId.toString() === selectedDeveloper);

  const formatChartData = (trend: QualityTrendResponse) => {
    return trend.trendData.map((point: any) => ({
      date: new Date(point.date).toLocaleDateString(),
      score: point.score || 0,
      status: point.status,
    }));
  };

  const getTrendIcon = (averageScore: number) => {
    if (averageScore >= 7) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (averageScore >= 5) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col">
          <DashboardNavbar title="Quality Trends" />
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="flex items-center justify-center h-64">
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
        <DashboardNavbar title="Quality Trends" />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Quality Trends</h1>
                <p className="text-muted-foreground text-sm mt-1">Track code review quality trends across developers</p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{allTrends?.length || 0} Developers</span>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filter by Developer</CardTitle>
                <CardDescription>Select a developer to view their quality trends</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedDeveloper} onValueChange={setSelectedDeveloper}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select developer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Developers</SelectItem>
                    {allTrends?.map(trend => (
                      <SelectItem key={trend.developerId} value={trend.developerId.toString()}>
                        {trend.developerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {selectedTrendData?.map((trend: QualityTrendResponse) => (
                <Card key={trend.developerId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-white">{trend.developerName}</CardTitle>
                      {getTrendIcon(trend.averageScore)}
                    </div>
                    <CardDescription>
                      {trend.totalReviews} reviews • {trend.acceptedReviews} accepted • {trend.rejectedReviews} rejected
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Average Score</span>
                      <span className={`text-2xl font-bold ${getScoreColor(trend.averageScore)}`}>
                        {trend.averageScore.toFixed(1)}/10
                      </span>
                    </div>

                    {trend.trendData.length > 0 && (
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={formatChartData(trend)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="score" 
                              stroke="#8884d8" 
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Badge variant="outline">
                        Acceptance Rate: {trend.totalReviews > 0 
                          ? ((trend.acceptedReviews / trend.totalReviews) * 100).toFixed(0) 
                          : 0}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedDeveloper === 'all' && allTrends && allTrends.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Overall Team Comparison</CardTitle>
                  <CardDescription>Average scores across all developers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="developerName" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 10]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageScore" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
