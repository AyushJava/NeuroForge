package com.neuroforge.backend.organization.controller;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.organization.dto.*;
import com.neuroforge.backend.organization.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@Tag(name = "Organization Management")
@SecurityRequirement(name = "bearerAuth")
public class OrganizationController {

    private final OrganizationService orgService;

    // ── Organizations ─────────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "List organizations")
    public ResponseEntity<ApiResponse<List<OrganizationDto>>> list(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(orgService.getAllOrganizations(user));
    }

    @GetMapping("/public")
    @Operation(summary = "List organizations for registration (public)")
    public ResponseEntity<ApiResponse<List<OrganizationDto>>> listPublic() {
        return ResponseEntity.ok(orgService.getPublicOrganizations());
    }

    @PostMapping
    @Operation(summary = "Create organization")
    public ResponseEntity<ApiResponse<OrganizationDto>> create(
            @Valid @RequestBody CreateOrganizationRequest req,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(orgService.createOrganization(req, user));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get organization by ID")
    public ResponseEntity<ApiResponse<OrganizationDto>> get(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.getOrganizationById(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update organization")
    public ResponseEntity<ApiResponse<OrganizationDto>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrganizationRequest req) {
        return ResponseEntity.ok(orgService.updateOrganization(id, req));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete organization")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.deleteOrganization(id));
    }

    @GetMapping("/{id}/stats")
    @Operation(summary = "Get organization stats")
    public ResponseEntity<ApiResponse<OrgStatsDto>> stats(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.getOrgStats(id));
    }

    // ── Teams ─────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/teams")
    @Operation(summary = "List teams in organization")
    public ResponseEntity<ApiResponse<List<TeamDto>>> listTeams(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.getAllTeams(id));
    }

    @PostMapping("/{id}/teams")
    @Operation(summary = "Create team in organization")
    public ResponseEntity<ApiResponse<TeamDto>> createTeam(
            @PathVariable Long id,
            @Valid @RequestBody CreateTeamRequest req) {
        return ResponseEntity.ok(orgService.createTeam(id, req));
    }

    @PutMapping("/{id}/teams/{teamId}")
    @Operation(summary = "Update team")
    public ResponseEntity<ApiResponse<TeamDto>> updateTeam(
            @PathVariable Long id,
            @PathVariable Long teamId,
            @Valid @RequestBody CreateTeamRequest req) {
        return ResponseEntity.ok(orgService.updateTeam(id, teamId, req));
    }

    @DeleteMapping("/{id}/teams/{teamId}")
    @Operation(summary = "Delete team")
    public ResponseEntity<ApiResponse<Void>> deleteTeam(
            @PathVariable Long id,
            @PathVariable Long teamId) {
        return ResponseEntity.ok(orgService.deleteTeam(id, teamId));
    }

    // ── Team Members ──────────────────────────────────────────────────────────

    @GetMapping("/{id}/teams/{teamId}/members")
    @Operation(summary = "List members of a team")
    public ResponseEntity<ApiResponse<List<TeamMemberDto>>> listTeamMembers(
            @PathVariable Long id,
            @PathVariable Long teamId) {
        return ResponseEntity.ok(orgService.getTeamMembers(id, teamId));
    }

    @PostMapping("/{id}/teams/{teamId}/members")
    @Operation(summary = "Add a member to a team")
    public ResponseEntity<ApiResponse<TeamMemberDto>> addTeamMember(
            @PathVariable Long id,
            @PathVariable Long teamId,
            @Valid @RequestBody AddTeamMemberRequest req) {
        return ResponseEntity.ok(orgService.addMemberToTeam(id, teamId, req.getMemberId()));
    }

    @DeleteMapping("/{id}/teams/{teamId}/members/{memberId}")
    @Operation(summary = "Remove a member from a team")
    public ResponseEntity<ApiResponse<Void>> removeTeamMember(
            @PathVariable Long id,
            @PathVariable Long teamId,
            @PathVariable Long memberId) {
        return ResponseEntity.ok(orgService.removeMemberFromTeam(id, teamId, memberId));
    }

    // ── Members ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}/members")
    @Operation(summary = "List members of organization")
    public ResponseEntity<ApiResponse<List<TeamMemberDto>>> listMembers(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.getAllMembers(id));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @Operation(summary = "Remove member from organization")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable Long id,
            @PathVariable Long memberId) {
        return ResponseEntity.ok(orgService.removeMember(id, memberId));
    }

    // ── Invitations ───────────────────────────────────────────────────────────

    @GetMapping("/{id}/invitations")
    @Operation(summary = "List invitations for organization")
    public ResponseEntity<ApiResponse<List<InviteDto>>> listInvitations(@PathVariable Long id) {
        return ResponseEntity.ok(orgService.getAllInvitations(id));
    }

    @PostMapping("/{id}/invitations")
    @Operation(summary = "Invite a member to organization")
    public ResponseEntity<ApiResponse<InviteDto>> inviteMember(
            @PathVariable Long id,
            @Valid @RequestBody InviteMemberRequest req,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(orgService.inviteMember(id, req, user));
    }

    @DeleteMapping("/{id}/invitations/{inviteId}")
    @Operation(summary = "Cancel invitation")
    public ResponseEntity<ApiResponse<Void>> cancelInvitation(
            @PathVariable Long id,
            @PathVariable Long inviteId) {
        return ResponseEntity.ok(orgService.cancelInvitation(id, inviteId));
    }

    @PostMapping("/{id}/invitations/{inviteId}/resend")
    @Operation(summary = "Resend invitation")
    public ResponseEntity<ApiResponse<Void>> resendInvitation(
            @PathVariable Long id,
            @PathVariable Long inviteId) {
        return ResponseEntity.ok(orgService.resendInvitation(id, inviteId));
    }
}
