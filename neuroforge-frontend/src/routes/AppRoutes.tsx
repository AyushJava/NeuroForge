import React from 'react';
import { Route, Switch } from 'wouter';

import LandingPage            from '@/pages/LandingPage';
import LoginPage              from '@/pages/LoginPage';
import SignupPage             from '@/pages/SignupPage';
import ForgotPasswordPage     from '@/pages/ForgotPasswordPage';
import ResetPasswordPage      from '@/pages/ResetPasswordPage';
import NotFound               from '@/pages/not-found';
import InvitationPage         from '@/pages/InvitationPage';
import PendingApprovalPage    from '@/pages/PendingApprovalPage';
import ProtectedRoute         from '@/components/common/ProtectedRoute';

// Role Dashboards
import SuperAdminDashboard      from '@/pages/dashboards/SuperAdminDashboard';
import OrgAdminDashboard        from '@/pages/dashboards/OrgAdminDashboard';
import ProjectManagerDashboard  from '@/pages/dashboards/ProjectManagerDashboard';
import DeveloperDashboard       from '@/pages/dashboards/DeveloperDashboard';
import QADashboard              from '@/pages/dashboards/QADashboard';
import ClientDashboard          from '@/pages/dashboards/ClientDashboard';

// Profile / Preferences / Settings / Search
import ProfilePage     from '@/pages/ProfilePage';
import PreferencesPage from '@/pages/PreferencesPage';
import SettingsPage    from '@/pages/SettingsPage';
import SearchPage      from '@/pages/SearchPage';

// Organization pages
import OrganizationListPage     from '@/pages/organizations/OrganizationListPage';
import OrganizationDetailPage   from '@/pages/organizations/OrganizationDetailPage';
import CreateOrganizationPage   from '@/pages/organizations/CreateOrganizationPage';

// Project pages
import ProjectListPage   from '@/pages/projects/ProjectListPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import CreateProjectPage from '@/pages/projects/CreateProjectPage';
import EditProjectPage   from '@/pages/projects/EditProjectPage';
import PortfolioDashboard from '@/pages/projects/PortfolioDashboard';

// Sprint pages (Module 5)
import SprintDashboardPage from '@/pages/sprints/SprintDashboardPage';

// Module 4: AI Specification Generator
import AIGeneratorPage from '@/pages/specifications/AIGeneratorPage';

// Module 7: Repository Integration
import RepositoryIntegrationPage from '@/pages/dashboards/RepositoryIntegrationPage';

// Module 8: AI Code Review Assistant
import CodeReviewPage from '@/pages/projects/CodeReviewPage';
import QualityTrendsPage from '@/pages/projects/QualityTrendsPage';

// Module 14: Analytics Dashboard
import AnalyticsDashboard from '@/pages/projects/AnalyticsDashboard';
import QAAnalyticsDashboard from '@/pages/projects/QAAnalyticsDashboard';
import ClientAnalyticsDashboard from '@/pages/projects/ClientAnalyticsDashboard';
import SuperAdminAnalyticsDashboard from '@/pages/projects/SuperAdminAnalyticsDashboard';

import { UiRoleSlug } from '@/lib/roleUtils';

const guard = (Component: React.ComponentType<any>, role: UiRoleSlug) =>
  <ProtectedRoute component={Component} allowedRole={role} />;

/** Routes shared across every role: profile, preferences, settings, search */
function sharedRoutes(r: UiRoleSlug) {
  return (
    <>
      <Route path={`/${r}/profile`}>     {guard(ProfilePage,     r)} </Route>
      <Route path={`/${r}/preferences`}> {guard(PreferencesPage, r)} </Route>
      <Route path={`/${r}/settings`}>    {guard(SettingsPage,    r)} </Route>
      <Route path={`/${r}/search`}>      {guard(SearchPage,      r)} </Route>
    </>
  );
}

export default function AppRoutes() {
  return (
    <Switch>
      {/* ── Public ──────────────────────────────────────────────────────────── */}
      <Route path="/"                component={LandingPage} />
      <Route path="/login"           component={LoginPage} />
      <Route path="/signup"          component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password"  component={ResetPasswordPage} />
      <Route path="/invitation"      component={InvitationPage} />
      <Route path="/pending-approval" component={PendingApprovalPage} />

      {/* ── Super Admin ─────────────────────────────────────────────────────── */}
      <Route path="/super-admin">{guard(SuperAdminDashboard, 'super-admin')}</Route>
      <Route path="/super-admin/organizations/new">{guard(CreateOrganizationPage, 'super-admin')}</Route>
      <Route path="/super-admin/organizations/:id">{guard(OrganizationDetailPage, 'super-admin')}</Route>
      <Route path="/super-admin/organizations">{guard(OrganizationListPage, 'super-admin')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/super-admin/analytics">{guard(SuperAdminAnalyticsDashboard, 'super-admin')}</Route>
      {sharedRoutes('super-admin')}
      <Route path="/super-admin/:rest*">{guard(SuperAdminDashboard, 'super-admin')}</Route>

      {/* ── Org Admin ───────────────────────────────────────────────────────── */}
      <Route path="/org-admin">{guard(OrgAdminDashboard, 'org-admin')}</Route>
      <Route path="/org-admin/organizations/new">{guard(CreateOrganizationPage, 'org-admin')}</Route>
      <Route path="/org-admin/organizations/:id">{guard(OrganizationDetailPage, 'org-admin')}</Route>
      <Route path="/org-admin/organizations">{guard(OrganizationListPage, 'org-admin')}</Route>
      <Route path="/org-admin/portfolio">{guard(PortfolioDashboard, 'org-admin')}</Route>
      <Route path="/org-admin/projects/:id">{guard(ProjectDetailPage, 'org-admin')}</Route>
      <Route path="/org-admin/projects">{guard(ProjectListPage, 'org-admin')}</Route>
      {/* Module 5 - Sprint Dashboard */}
      <Route path="/org-admin/projects/:id/sprints/:sprintId/dashboard">{guard(SprintDashboardPage, 'org-admin')}</Route>
      {/* Module 4 - AI Specification Generator */}
      <Route path="/org-admin/specifications/generate">{guard(AIGeneratorPage, 'org-admin')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/org-admin/analytics">{guard(AnalyticsDashboard, 'org-admin')}</Route>
      {sharedRoutes('org-admin')}
      <Route path="/org-admin/:rest*">{guard(OrgAdminDashboard, 'org-admin')}</Route>

      {/* ── Project Manager ─────────────────────────────────────────────────── */}
      <Route path="/project-manager">{guard(ProjectManagerDashboard, 'project-manager')}</Route>
      <Route path="/project-manager/portfolio">{guard(PortfolioDashboard, 'project-manager')}</Route>
      <Route path="/project-manager/projects/new">{guard(CreateProjectPage, 'project-manager')}</Route>
      <Route path="/project-manager/projects/:id/edit">{guard(EditProjectPage, 'project-manager')}</Route>
      <Route path="/project-manager/projects/:id">{guard(ProjectDetailPage, 'project-manager')}</Route>
      <Route path="/project-manager/projects">{guard(ProjectListPage, 'project-manager')}</Route>
      {/* Module 5 - Sprint Dashboard */}
      <Route path="/project-manager/projects/:id/sprints/:sprintId/dashboard">{guard(SprintDashboardPage, 'project-manager')}</Route>
      {/* Module 4 - AI Specification Generator */}
      <Route path="/project-manager/specifications/generate">{guard(AIGeneratorPage, 'project-manager')}</Route>
      {/* Module 7 - Repository Integration */}
      <Route path="/project-manager/projects/:id/repositories">{guard(RepositoryIntegrationPage, 'project-manager')}</Route>
      {/* Module 8 - AI Code Review Assistant */}
      <Route path="/project-manager/projects/:id/code-review">{guard(CodeReviewPage, 'project-manager')}</Route>
      <Route path="/project-manager/quality-trends">{guard(QualityTrendsPage, 'project-manager')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/project-manager/analytics">{guard(AnalyticsDashboard, 'project-manager')}</Route>
      {sharedRoutes('project-manager')}
      <Route path="/project-manager/:rest*">{guard(ProjectManagerDashboard, 'project-manager')}</Route>

      {/* ── Developer ───────────────────────────────────────────────────────── */}
      <Route path="/developer">{guard(DeveloperDashboard, 'developer')}</Route>
      <Route path="/developer/projects/:id">{guard(ProjectDetailPage, 'developer')}</Route>
      <Route path="/developer/projects">{guard(ProjectListPage, 'developer')}</Route>
      {/* Module 5 - Sprint Dashboard */}
      <Route path="/developer/projects/:id/sprints/:sprintId/dashboard">{guard(SprintDashboardPage, 'developer')}</Route>
      {/* Module 8 - AI Code Review Assistant */}
      <Route path="/developer/projects/:id/code-review">{guard(CodeReviewPage, 'developer')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/developer/analytics">{guard(AnalyticsDashboard, 'developer')}</Route>
      {sharedRoutes('developer')}
      <Route path="/developer/:rest*">{guard(DeveloperDashboard, 'developer')}</Route>

      {/* ── QA ──────────────────────────────────────────────────────────────── */}
      <Route path="/qa">{guard(QADashboard, 'qa')}</Route>
      <Route path="/qa/projects/:id">{guard(ProjectDetailPage, 'qa')}</Route>
      <Route path="/qa/projects">{guard(ProjectListPage, 'qa')}</Route>
      {/* Module 5 - Sprint Dashboard */}
      <Route path="/qa/projects/:id/sprints/:sprintId/dashboard">{guard(SprintDashboardPage, 'qa')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/qa/analytics">{guard(QAAnalyticsDashboard, 'qa')}</Route>
      {sharedRoutes('qa')}
      <Route path="/qa/:rest*">{guard(QADashboard, 'qa')}</Route>

      {/* ── Client ──────────────────────────────────────────────────────────── */}
      <Route path="/client">{guard(ClientDashboard, 'client')}</Route>
      <Route path="/client/projects/:id">{guard(ProjectDetailPage, 'client')}</Route>
      <Route path="/client/projects">{guard(ProjectListPage, 'client')}</Route>
      {/* Module 5 - Sprint Dashboard */}
      <Route path="/client/projects/:id/sprints/:sprintId/dashboard">{guard(SprintDashboardPage, 'client')}</Route>
      {/* Module 14 - Analytics Dashboard */}
      <Route path="/client/analytics">{guard(ClientAnalyticsDashboard, 'client')}</Route>
      {sharedRoutes('client')}
      <Route path="/client/:rest*">{guard(ClientDashboard, 'client')}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}
