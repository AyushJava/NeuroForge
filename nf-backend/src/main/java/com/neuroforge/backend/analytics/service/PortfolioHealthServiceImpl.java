package com.neuroforge.backend.analytics.service;

import com.neuroforge.backend.analytics.dto.PortfolioHealthResponse;
import com.neuroforge.backend.analytics.dto.ProjectHealthSummary;
import com.neuroforge.backend.organization.entity.Organization;
import com.neuroforge.backend.organization.entity.Team;
import com.neuroforge.backend.specification.exception.ResourceNotFoundException;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import com.neuroforge.backend.organization.repository.TeamRepository;
import com.neuroforge.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioHealthServiceImpl implements PortfolioHealthService {

    public static final double HEALTHY_THRESHOLD = 70.0;
    public static final double AT_RISK_THRESHOLD = 40.0;

    private final OrganizationRepository organizationRepository;
    private final TeamRepository teamRepository;
    private final TaskRepository taskRepository;

    @Override
    public PortfolioHealthResponse getPortfolioHealth(Long organizationId) {
        // Organization access verification: Org Admins can only access their own organization
        if (SecurityUtils.isOrgAdmin()) {
            Long currentOrgId = SecurityUtils.getCurrentUserOrganizationId().orElse(null);
            if (currentOrgId == null || !currentOrgId.equals(organizationId)) {
                log.warn("Org Admin attempting to access organization {} but belongs to {}", organizationId, currentOrgId);
                return PortfolioHealthResponse.builder()
                        .organizationId(organizationId)
                        .organizationName("Access Denied")
                        .totalProjects(0)
                        .healthyProjects(0)
                        .atRiskProjects(0)
                        .criticalProjects(0)
                        .overallCompletionPercentage(0.0)
                        .totalStoryPoints(0)
                        .completedStoryPoints(0)
                        .totalTasks(0L)
                        .completedTasks(0L)
                        .projects(Collections.emptyList())
                        .build();
            }
        }
        
        try {
            Organization organization = organizationRepository.findById(organizationId)
                    .orElse(null);

            if (organization == null) {
                log.warn("Organization not found with id: {}", organizationId);
                return PortfolioHealthResponse.builder()
                        .organizationId(organizationId)
                        .organizationName("Organization Not Found")
                        .totalProjects(0)
                        .healthyProjects(0)
                        .atRiskProjects(0)
                        .criticalProjects(0)
                        .overallCompletionPercentage(0.0)
                        .totalStoryPoints(0)
                        .completedStoryPoints(0)
                        .totalTasks(0L)
                        .completedTasks(0L)
                        .projects(Collections.emptyList())
                        .build();
            }

            List<Team> teams;
            try {
                teams = teamRepository.findByOrganizationId(organizationId);
            } catch (Exception e) {
                log.error("Error fetching teams for organization: {}", organizationId, e);
                teams = Collections.emptyList();
            }

            List<Team> validTeams = new ArrayList<>();
            if (teams != null) {
                for (Team team : teams) {
                    if (team != null && team.getId() != null) {
                        validTeams.add(team);
                    }
                }
            }

            if (validTeams.isEmpty()) {
                return PortfolioHealthResponse.builder()
                        .organizationId(organizationId)
                        .organizationName(organization.getName())
                        .totalProjects(0)
                        .healthyProjects(0)
                        .atRiskProjects(0)
                        .criticalProjects(0)
                        .overallCompletionPercentage(0.0)
                        .totalStoryPoints(0)
                        .completedStoryPoints(0)
                        .totalTasks(0L)
                        .completedTasks(0L)
                        .projects(Collections.emptyList())
                        .build();
            }

            validTeams.sort(Comparator.comparing(t -> t.getName() == null ? "" : t.getName(), String::compareToIgnoreCase));

            int healthyProjects = 0;
            int atRiskProjects = 0;
            int criticalProjects = 0;

            long overallTotalTasks = 0;
            long overallCompletedTasks = 0;
            int overallTotalStoryPoints = 0;
            int overallCompletedStoryPoints = 0;

            List<ProjectHealthSummary> projectSummaries = new ArrayList<>();

            // Get organization-wide task metrics instead of per-team
            long orgTotalTasks = taskRepository.countByOrganizationId(organizationId);
            long orgCompletedTasks = taskRepository.countByOrganizationIdAndStatus(organizationId, "DONE");
            Integer orgTotalStoryPoints = taskRepository.getTotalStoryPointsByOrganization(organizationId);
            Integer orgCompletedStoryPoints = taskRepository.getStoryPointsByOrganizationAndStatus(organizationId, "DONE");

            log.info("Organization {} metrics: totalTasks={}, completedTasks={}, totalStoryPoints={}, completedStoryPoints={}",
                    organizationId, orgTotalTasks, orgCompletedTasks, orgTotalStoryPoints, orgCompletedStoryPoints);

            for (Team team : validTeams) {
                if (team == null || team.getId() == null) {
                    continue;
                }

                // Use organization-wide metrics for each team/project summary
                long teamTotalTasks = orgTotalTasks;
                long teamCompletedTasks = orgCompletedTasks;
                int teamTotalStoryPoints = orgTotalStoryPoints != null ? orgTotalStoryPoints : 0;
                int teamCompletedStoryPoints = orgCompletedStoryPoints != null ? orgCompletedStoryPoints : 0;

                int activeSprints = 0;
                int completedSprints = 0;

                double teamCompletionPercentage = teamTotalTasks > 0
                        ? Math.round(((teamCompletedTasks * 100.0) / teamTotalTasks) * 100.0) / 100.0
                        : 0.0;

                String healthStatus;
                if (teamTotalTasks > 0) {
                    if (teamCompletionPercentage >= HEALTHY_THRESHOLD) {
                        healthStatus = "HEALTHY";
                        healthyProjects++;
                    } else if (teamCompletionPercentage >= AT_RISK_THRESHOLD) {
                        healthStatus = "AT_RISK";
                        atRiskProjects++;
                    } else {
                        healthStatus = "CRITICAL";
                        criticalProjects++;
                    }
                } else {
                    healthStatus = "HEALTHY";
                    healthyProjects++;
                }

                projectSummaries.add(ProjectHealthSummary.builder()
                        .projectId(team.getId())
                        .projectName(team.getName())
                        .teamId(team.getId())
                        .healthStatus(healthStatus)
                        .totalTasks(teamTotalTasks)
                        .completedTasks(teamCompletedTasks)
                        .completionPercentage(teamCompletionPercentage)
                        .totalStoryPoints(teamTotalStoryPoints)
                        .completedStoryPoints(teamCompletedStoryPoints)
                        .activeSprints(activeSprints)
                        .completedSprints(completedSprints)
                        .build());

                overallTotalTasks += teamTotalTasks;
                overallCompletedTasks += teamCompletedTasks;
                overallTotalStoryPoints += teamTotalStoryPoints;
                overallCompletedStoryPoints += teamCompletedStoryPoints;
            }

            double overallCompletionPercentage = overallTotalTasks > 0
                    ? Math.round(((overallCompletedTasks * 100.0) / overallTotalTasks) * 100.0) / 100.0
                    : 0.0;

            return PortfolioHealthResponse.builder()
                    .organizationId(organizationId)
                    .organizationName(organization.getName())
                    .totalProjects(projectSummaries.size())
                    .healthyProjects(healthyProjects)
                    .atRiskProjects(atRiskProjects)
                    .criticalProjects(criticalProjects)
                    .overallCompletionPercentage(overallCompletionPercentage)
                    .totalStoryPoints(overallTotalStoryPoints)
                    .completedStoryPoints(overallCompletedStoryPoints)
                    .totalTasks(overallTotalTasks)
                    .completedTasks(overallCompletedTasks)
                    .projects(projectSummaries)
                    .build();
        } catch (Exception e) {
            log.error("Unexpected error fetching portfolio health for organization: {}", organizationId, e);
            // Return empty response for other errors
            return PortfolioHealthResponse.builder()
                    .organizationId(organizationId)
                    .organizationName("Error")
                    .totalProjects(0)
                    .healthyProjects(0)
                    .atRiskProjects(0)
                    .criticalProjects(0)
                    .overallCompletionPercentage(0.0)
                    .totalStoryPoints(0)
                    .completedStoryPoints(0)
                    .totalTasks(0L)
                    .completedTasks(0L)
                    .projects(Collections.emptyList())
                    .build();
        }
    }
}
