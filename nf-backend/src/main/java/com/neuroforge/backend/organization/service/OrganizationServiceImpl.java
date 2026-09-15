package com.neuroforge.backend.organization.service;

import com.neuroforge.backend.dto.ApiResponse;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.organization.dto.*;
import com.neuroforge.backend.organization.entity.*;
import com.neuroforge.backend.organization.repository.*;
import com.neuroforge.backend.project.entity.Project;
import com.neuroforge.backend.project.repository.ProjectMemberRepository;
import com.neuroforge.backend.project.repository.ProjectRepository;
import com.neuroforge.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrganizationServiceImpl implements OrganizationService {

    private final OrganizationRepository orgRepo;
    private final TeamRepository teamRepo;
    private final TeamMemberRepository memberRepo;
    private final InviteRepository inviteRepo;
    private final UserRepository userRepo;
    private final JavaMailSender mailSender;
    private final ProjectRepository projectRepo;
    private final ProjectMemberRepository projectMemberRepo;

    @Value("${app.frontend.url:http://localhost:5000}")
    private String frontendUrl;

    // ── Organizations ─────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<OrganizationDto> createOrganization(CreateOrganizationRequest req, User currentUser) {
        if (orgRepo.existsBySlug(req.getSlug())) {
            throw AppException.conflict("An organization with this slug already exists");
        }
        Organization org = Organization.builder()
                .name(req.getName())
                .slug(req.getSlug())
                .industry(req.getIndustry())
                .size(req.getSize())
                .plan(req.getPlan() != null ? req.getPlan() : "FREE")
                .description(req.getDescription())
                .createdBy(currentUser)
                .build();
        org = orgRepo.save(org);

        // If the user is registering as a project manager or org-admin, automatically add them as a member
        // This is needed for users who register directly with an organization (not via invitation)
        if ("ROLE_ORG_ADMIN".equals(currentUser.getRole()) || "ROLE_PROJECT_MANAGER".equals(currentUser.getRole())) {
            boolean alreadyMember = memberRepo.findByUserIdAndOrganizationId(currentUser.getId(), org.getId()).isPresent();
            if (!alreadyMember) {
                OrgRole orgRole = "ROLE_ORG_ADMIN".equals(currentUser.getRole()) ? OrgRole.ORG_ADMIN : OrgRole.PROJECT_MANAGER;
                TeamMember teamMember = TeamMember.builder()
                        .user(currentUser)
                        .organization(org)
                        .role(orgRole)
                        .build();
                memberRepo.save(teamMember);
                log.info("Created TeamMember for user {} in org {} during organization creation", currentUser.getId(), org.getId());
            }
        }

        return ApiResponse.ok("Organization created", OrganizationDto.from(org));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<OrganizationDto>> getAllOrganizations(User currentUser) {
        List<Organization> orgs;
        boolean isSuperAdmin = "ROLE_SUPER_ADMIN".equals(currentUser.getRole());
        if (isSuperAdmin) {
            orgs = orgRepo.findAll();
        } else {
            List<Long> orgIds = memberRepo.findByUserId(currentUser.getId())
                    .stream().map(m -> m.getOrganization().getId()).collect(Collectors.toList());

            // Only include organizationId if user has no TeamMember records (for users who registered but not yet approved)
            if (orgIds.isEmpty() && currentUser.getOrganizationId() != null) {
                orgIds.add(currentUser.getOrganizationId());
            }

            orgs = orgRepo.findAllById(orgIds);
        }
        return ApiResponse.ok("Organizations retrieved",
                orgs.stream().map(OrganizationDto::from).collect(Collectors.toList()));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<OrganizationDto>> getPublicOrganizations() {
        List<Organization> orgs = orgRepo.findAll();
        return ApiResponse.ok("Public organizations retrieved",
                orgs.stream().map(OrganizationDto::from).collect(Collectors.toList()));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<OrganizationDto> getOrganizationById(Long id) {
        Organization org = orgRepo.findById(id)
                .orElseThrow(() -> AppException.notFound("Organization not found"));
        return ApiResponse.ok("Organization found", OrganizationDto.from(org));
    }

    @Override
    @Transactional
    public ApiResponse<OrganizationDto> updateOrganization(Long id, UpdateOrganizationRequest req) {
        Organization org = orgRepo.findById(id)
                .orElseThrow(() -> AppException.notFound("Organization not found"));
        if (req.getName() != null)        org.setName(req.getName());
        if (req.getIndustry() != null)    org.setIndustry(req.getIndustry());
        if (req.getSize() != null)        org.setSize(req.getSize());
        if (req.getDescription() != null) org.setDescription(req.getDescription());
        org = orgRepo.save(org);
        return ApiResponse.ok("Organization updated", OrganizationDto.from(org));
    }

    /**
     * Delete an organisation and ALL related data in the correct order to satisfy
     * foreign-key constraints:
     *
     * 1. ProjectMember records (FK → TeamMember) for every project in this org
     * 2. Projects (cascades → Sprints, Tasks)
     * 3. Organisation (cascades → Teams, TeamMembers, Invites)
     */
    @Override
    @Transactional
    public ApiResponse<Void> deleteOrganization(Long id) {
        if (!orgRepo.existsById(id)) throw AppException.notFound("Organization not found");

        // Step 1: Remove project_members FK references to team_members
        projectMemberRepo.deleteByProjectOrganizationId(id);

        // Step 2: Delete projects (cascades to Sprints and Tasks)
        List<Project> projects = projectRepo.findByOrganizationIdWithOrganization(id);
        projectRepo.deleteAll(projects);

        // Step 3: Delete the org — JPA cascades to Team, TeamMember, Invite
        orgRepo.deleteById(id);

        return ApiResponse.ok("Organization deleted");
    }

    /**
     * Return live statistics for an organisation.
     * projectsCount was previously hardcoded to 0 — now uses the ProjectRepository.
     */
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<OrgStatsDto> getOrgStats(Long id) {
        if (!orgRepo.existsById(id)) throw AppException.notFound("Organization not found");
        long teams    = teamRepo.findByOrganizationId(id).size();
        long members  = memberRepo.countByOrganizationId(id);
        long pending  = inviteRepo.countByOrganizationIdAndStatus(id, InviteStatus.PENDING);
        long projects = projectRepo.countByOrganizationId(id);
        return ApiResponse.ok("Stats retrieved", OrgStatsDto.builder()
                .teamsCount(teams)
                .membersCount(members)
                .pendingInvitesCount(pending)
                .projectsCount(projects)
                .build());
    }

    // ── Teams ─────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<TeamDto> createTeam(Long orgId, CreateTeamRequest req) {
        Organization org = orgRepo.findById(orgId)
                .orElseThrow(() -> AppException.notFound("Organization not found"));
        User lead = req.getLeadId() != null ? userRepo.findById(req.getLeadId()).orElse(null) : null;
        Team team = Team.builder()
                .name(req.getName())
                .description(req.getDescription())
                .organization(org)
                .lead(lead)
                .build();
        team = teamRepo.save(team);
        final Team savedTeam = team;

        if (req.getInitialMemberIds() != null && !req.getInitialMemberIds().isEmpty()) {
            for (Long memberId : req.getInitialMemberIds()) {
                memberRepo.findById(memberId).ifPresent(member -> {
                    if (member.getOrganization().getId().equals(orgId)) {
                        member.setTeam(savedTeam);
                        memberRepo.save(member);
                    }
                });
            }
        }

        Team reloaded = teamRepo.findById(savedTeam.getId()).orElse(savedTeam);
        return ApiResponse.ok("Team created", TeamDto.from(reloaded));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TeamDto>> getAllTeams(Long orgId) {
        return ApiResponse.ok("Teams retrieved",
                teamRepo.findByOrganizationId(orgId).stream()
                        .map(TeamDto::from).collect(Collectors.toList()));
    }

    @Override
    @Transactional
    public ApiResponse<TeamDto> updateTeam(Long orgId, Long teamId, CreateTeamRequest req) {
        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> AppException.notFound("Team not found"));
        if (!team.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Team does not belong to this organization");
        if (req.getName() != null)        team.setName(req.getName());
        if (req.getDescription() != null) team.setDescription(req.getDescription());
        if (req.getLeadId() != null) {
            team.setLead(userRepo.findById(req.getLeadId()).orElse(null));
        }
        return ApiResponse.ok("Team updated", TeamDto.from(teamRepo.save(team)));
    }

    /**
     * Delete a team without touching the TeamMember records.
     *
     * The Team entity has {@code orphanRemoval = true} on its members collection,
     * which would cascade-DELETE TeamMember rows if they were removed from the
     * collection.  But TeamMember rows may be referenced by ProjectMember (FK),
     * causing a constraint violation.
     *
     * Fix: use a bulk JPQL UPDATE to set team_id = NULL for every member of the
     * team BEFORE the team is deleted.  Those members remain in the organisation.
     */
    @Override
    @Transactional
    public ApiResponse<Void> deleteTeam(Long orgId, Long teamId) {
        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> AppException.notFound("Team not found"));
        if (!team.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Team does not belong to this organization");

        // Detach every member from the team (sets team_id = NULL in DB).
        // clearAutomatically = true on the repository method refreshes the
        // first-level cache so the subsequent delete sees no children.
        memberRepo.detachFromTeam(teamId);

        teamRepo.deleteById(teamId);
        return ApiResponse.ok("Team deleted");
    }

    // ── Team Members ──────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TeamMemberDto>> getTeamMembers(Long orgId, Long teamId) {
        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> AppException.notFound("Team not found"));
        if (!team.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Team does not belong to this organization");
        List<TeamMemberDto> members = memberRepo.findByOrganizationId(orgId).stream()
                .filter(m -> m.getTeam() != null && m.getTeam().getId().equals(teamId))
                .map(TeamMemberDto::from)
                .collect(Collectors.toList());
        return ApiResponse.ok("Team members retrieved", members);
    }

    @Override
    @Transactional
    public ApiResponse<TeamMemberDto> addMemberToTeam(Long orgId, Long teamId, Long memberId) {
        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> AppException.notFound("Team not found"));
        if (!team.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Team does not belong to this organization");
        TeamMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> AppException.notFound("Member not found"));
        if (!member.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Member does not belong to this organization");
        member.setTeam(team);
        return ApiResponse.ok("Member added to team", TeamMemberDto.from(memberRepo.save(member)));
    }

    @Override
    @Transactional
    public ApiResponse<Void> removeMemberFromTeam(Long orgId, Long teamId, Long memberId) {
        TeamMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> AppException.notFound("Member not found"));
        if (!member.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Member does not belong to this organization");
        if (member.getTeam() == null || !member.getTeam().getId().equals(teamId))
            throw AppException.badRequest("Member is not part of this team");
        member.setTeam(null);
        memberRepo.save(member);
        return ApiResponse.ok("Member removed from team");
    }

    // ── Members ───────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TeamMemberDto>> getAllMembers(Long orgId) {
        return ApiResponse.ok("Members retrieved",
                memberRepo.findByOrganizationId(orgId).stream()
                        .map(TeamMemberDto::from).collect(Collectors.toList()));
    }

    /**
     * Remove a member from the organisation.
     *
     * Must delete ProjectMember records first because they hold a FK to
     * TeamMember.  Skipping this step causes a constraint violation.
     */
    @Override
    @Transactional
    public ApiResponse<Void> removeMember(Long orgId, Long memberId) {
        TeamMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> AppException.notFound("Member not found"));
        if (!member.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Member does not belong to this organization");

        // Remove FK references from project_members before deleting the team_member row.
        projectMemberRepo.deleteByTeamMemberId(memberId);

        memberRepo.deleteById(memberId);
        return ApiResponse.ok("Member removed");
    }

    // ── Invitations ───────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<InviteDto> inviteMember(Long orgId, InviteMemberRequest req, User currentUser) {
        Organization org = orgRepo.findById(orgId)
                .orElseThrow(() -> AppException.notFound("Organization not found"));
        Invite invite = Invite.builder()
                .email(req.getEmail())
                .organization(org)
                .invitedBy(currentUser)
                .role(req.getRole())
                .status(InviteStatus.PENDING)
                .build();
        invite = inviteRepo.save(invite);
        sendInvitationEmail(invite);
        return ApiResponse.ok("Invitation sent", InviteDto.from(invite));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<InviteDto>> getAllInvitations(Long orgId) {
        return ApiResponse.ok("Invitations retrieved",
                inviteRepo.findByOrganizationId(orgId).stream()
                        .map(InviteDto::from).collect(Collectors.toList()));
    }

    @Override
    @Transactional
    public ApiResponse<Void> cancelInvitation(Long orgId, Long inviteId) {
        Invite invite = inviteRepo.findById(inviteId)
                .orElseThrow(() -> AppException.notFound("Invitation not found"));
        if (!invite.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Invitation does not belong to this organization");
        invite.setStatus(InviteStatus.CANCELLED);
        invite.setRespondedAt(LocalDateTime.now());
        inviteRepo.save(invite);
        return ApiResponse.ok("Invitation cancelled");
    }

    @Override
    @Transactional
    public ApiResponse<Void> resendInvitation(Long orgId, Long inviteId) {
        Invite invite = inviteRepo.findById(inviteId)
                .orElseThrow(() -> AppException.notFound("Invitation not found"));
        if (!invite.getOrganization().getId().equals(orgId))
            throw AppException.badRequest("Invitation does not belong to this organization");
        invite.setToken(UUID.randomUUID().toString());
        invite.setExpiresAt(LocalDateTime.now().plusDays(7));
        invite.setStatus(InviteStatus.PENDING);
        inviteRepo.save(invite);
        sendInvitationEmail(invite);
        return ApiResponse.ok("Invitation resent");
    }

    @Override
    @Transactional
    public ApiResponse<Void> acceptInvitation(String token) {
        Invite invite = inviteRepo.findByToken(token)
                .orElseThrow(() -> AppException.notFound("Invalid invitation token"));
        if (invite.getStatus() != InviteStatus.PENDING)
            throw AppException.badRequest("Invitation is no longer pending");
        if (invite.getExpiresAt().isBefore(LocalDateTime.now()))
            throw AppException.badRequest("Invitation has expired");

        log.info("Processing invitation acceptance for email: {}, org: {}", 
                invite.getEmail(), invite.getOrganization().getId());

        userRepo.findByEmail(invite.getEmail()).ifPresentOrElse(user -> {
            boolean alreadyMember = memberRepo.findByUserIdAndOrganizationId(
                    user.getId(), invite.getOrganization().getId()).isPresent();
            if (!alreadyMember) {
                TeamMember teamMember = memberRepo.save(TeamMember.builder()
                        .user(user)
                        .organization(invite.getOrganization())
                        .role(invite.getRole())
                        .build());
                log.info("Created TeamMember id {} for user {} in org {} during invitation acceptance",
                        teamMember.getId(), user.getId(), invite.getOrganization().getId());
            } else {
                log.info("User {} is already a member of org {}", user.getId(), invite.getOrganization().getId());
            }
        }, () -> {
            log.info("User with email {} does not exist yet. Invitation will be accepted and TeamMember will be created on registration.",
                    invite.getEmail());
        });

        invite.setStatus(InviteStatus.ACCEPTED);
        invite.setRespondedAt(LocalDateTime.now());
        inviteRepo.save(invite);
        log.info("Invitation {} accepted for email {}", invite.getId(), invite.getEmail());
        return ApiResponse.ok("Invitation accepted");
    }

    @Override
    @Transactional
    public ApiResponse<Void> rejectInvitation(String token) {
        Invite invite = inviteRepo.findByToken(token)
                .orElseThrow(() -> AppException.notFound("Invalid invitation token"));
        if (invite.getStatus() != InviteStatus.PENDING)
            throw AppException.badRequest("Invitation is no longer pending");
        invite.setStatus(InviteStatus.REJECTED);
        invite.setRespondedAt(LocalDateTime.now());
        inviteRepo.save(invite);
        return ApiResponse.ok("Invitation rejected");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void sendInvitationEmail(Invite invite) {
        try {
            String link = frontendUrl + "/invitation?token=" + invite.getToken();
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(invite.getEmail());
            msg.setSubject("You're invited to join " + invite.getOrganization().getName() + " on NeuroForge");
            msg.setText(
                "Hello,\n\n" +
                "You have been invited to join the organization \"" + invite.getOrganization().getName()
                + "\" on NeuroForge as " + invite.getRole().name().replace("_", " ") + ".\n\n" +
                "Click the link below to accept or reject this invitation:\n\n" + link + "\n\n" +
                "If the link above does not open, copy and paste it into your browser's address bar.\n\n" +
                "This invitation expires on " + invite.getExpiresAt() + ".\n\n" +
                "The NeuroForge Team"
            );
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}: {}", invite.getEmail(), e.getMessage());
        }
    }
}
