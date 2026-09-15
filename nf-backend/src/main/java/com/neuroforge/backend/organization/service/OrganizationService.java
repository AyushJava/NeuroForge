package com.neuroforge.backend.organization.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.organization.dto.*;

import java.util.List;

public interface OrganizationService {
    ApiResponse<OrganizationDto> createOrganization(CreateOrganizationRequest request, User currentUser);
    ApiResponse<List<OrganizationDto>> getAllOrganizations(User currentUser);
    ApiResponse<List<OrganizationDto>> getPublicOrganizations();
    ApiResponse<OrganizationDto> getOrganizationById(Long id);
    ApiResponse<OrganizationDto> updateOrganization(Long id, UpdateOrganizationRequest request);
    ApiResponse<Void> deleteOrganization(Long id);
    ApiResponse<OrgStatsDto> getOrgStats(Long id);

    ApiResponse<TeamDto> createTeam(Long orgId, CreateTeamRequest request);
    ApiResponse<List<TeamDto>> getAllTeams(Long orgId);
    ApiResponse<TeamDto> updateTeam(Long orgId, Long teamId, CreateTeamRequest request);
    ApiResponse<Void> deleteTeam(Long orgId, Long teamId);

    // Team member management
    ApiResponse<List<TeamMemberDto>> getTeamMembers(Long orgId, Long teamId);
    ApiResponse<TeamMemberDto> addMemberToTeam(Long orgId, Long teamId, Long memberId);
    ApiResponse<Void> removeMemberFromTeam(Long orgId, Long teamId, Long memberId);

    ApiResponse<List<TeamMemberDto>> getAllMembers(Long orgId);
    ApiResponse<Void> removeMember(Long orgId, Long memberId);

    ApiResponse<InviteDto> inviteMember(Long orgId, InviteMemberRequest request, User currentUser);
    ApiResponse<List<InviteDto>> getAllInvitations(Long orgId);
    ApiResponse<Void> cancelInvitation(Long orgId, Long inviteId);
    ApiResponse<Void> resendInvitation(Long orgId, Long inviteId);
    ApiResponse<Void> acceptInvitation(String token);
    ApiResponse<Void> rejectInvitation(String token);
}
