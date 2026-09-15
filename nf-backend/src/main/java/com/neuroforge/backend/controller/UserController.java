package com.neuroforge.backend.controller;

import com.neuroforge.backend.dto.*;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.organization.repository.InviteRepository;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.organization.repository.TeamMemberRepository;
import com.neuroforge.backend.organization.repository.TeamRepository;
import com.neuroforge.backend.repository.UserRepository;
import com.neuroforge.backend.project.repository.ProjectMemberRepository;
import com.neuroforge.backend.project.repository.TaskRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "User Management")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final InviteRepository inviteRepository;
    private final OrganizationRepository organizationRepository;
    private final TeamRepository teamRepository;
    private final com.neuroforge.backend.project.repository.CodeReviewRepository codeReviewRepository;

    // ── Current user profile ─────────────────────────────────────────────────

    @GetMapping("/me")
    @Operation(summary = "Get current user's profile")
    public ResponseEntity<ApiResponse<UserDTO>> getMyProfile(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok("Profile retrieved", UserDTO.from(currentUser)));
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user's profile")
    public ResponseEntity<ApiResponse<UserDTO>> updateMyProfile(
            @AuthenticationPrincipal User currentUser,
            @RequestBody UpdateProfileRequest req) {
        if (req.getName() != null && !req.getName().isBlank())
            currentUser.setName(req.getName());
        if (req.getPhone() != null)
            currentUser.setPhone(req.getPhone());
        if (req.getAvatarUrl() != null)
            currentUser.setAvatarUrl(req.getAvatarUrl());
        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            boolean exists = userRepository.findByUsername(req.getUsername())
                    .filter(u -> !u.getId().equals(currentUser.getId())).isPresent();
            if (exists) throw AppException.conflict("Username already taken");
            currentUser.setUsername(req.getUsername());
        }
        User saved = userRepository.save(currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Profile updated", UserDTO.from(saved)));
    }

    @PutMapping("/me/password")
    @Operation(summary = "Change current user's password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal User currentUser,
            @RequestBody ChangePasswordRequest req) {
        if (!passwordEncoder.matches(req.getCurrentPassword(), currentUser.getPassword()))
            throw AppException.badRequest("Current password is incorrect");
        if (req.getNewPassword() == null || req.getNewPassword().length() < 8)
            throw AppException.badRequest("New password must be at least 8 characters");
        currentUser.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully"));
    }

    @GetMapping("/me/preferences")
    @Operation(summary = "Get current user's preferences")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPreferences(
            @AuthenticationPrincipal User currentUser) {
        // Use Boolean.TRUE.equals() for null-safe comparison since
        // notificationsEnabled is a Boolean wrapper that may be null in old rows.
        boolean notificationsEnabled = !Boolean.FALSE.equals(currentUser.getNotificationsEnabled());
        Map<String, Object> prefs = Map.of(
                "theme",         currentUser.getTheme()    != null ? currentUser.getTheme()    : "dark",
                "notifications", notificationsEnabled,
                "language",      currentUser.getLanguage() != null ? currentUser.getLanguage() : "English",
                "timezone",      currentUser.getTimezone() != null ? currentUser.getTimezone() : "UTC"
        );
        return ResponseEntity.ok(ApiResponse.ok("Preferences retrieved", prefs));
    }

    @PutMapping("/me/preferences")
    @Operation(summary = "Save current user's preferences")
    public ResponseEntity<ApiResponse<Void>> savePreferences(
            @AuthenticationPrincipal User currentUser,
            @RequestBody PreferencesRequest req) {
        if (req.getTheme() != null)         currentUser.setTheme(req.getTheme());
        if (req.getLanguage() != null)      currentUser.setLanguage(req.getLanguage());
        if (req.getTimezone() != null)      currentUser.setTimezone(req.getTimezone());
        if (req.getNotifications() != null) currentUser.setNotificationsEnabled(req.getNotifications());
        userRepository.save(currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Preferences saved"));
    }

    // ── Admin user management ─────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @Operation(summary = "Create a new user (Super Admin only)")
    @Transactional
    public ResponseEntity<ApiResponse<UserDTO>> createUser(@Valid @RequestBody CreateUserRequest req) {
        // Check if username already exists
        if (userRepository.findByUsername(req.getUsername()).isPresent()) {
            throw AppException.conflict("Username already taken");
        }
        // Check if email already exists
        if (userRepository.findByEmail(req.getEmail()).isPresent()) {
            throw AppException.conflict("Email already taken");
        }

        User user = User.builder()
                .name(req.getName())
                .username(req.getUsername())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .role(req.getRole())
                .organizationId(req.getOrganizationId())
                .enabled(req.getEnabled() != null ? req.getEnabled() : true)
                .build();

        User saved = userRepository.save(user);

        // If organizationId is provided, create a TeamMember record to add the user to the organization
        if (req.getOrganizationId() != null) {
            organizationRepository.findById(req.getOrganizationId()).ifPresent(org -> {
                boolean alreadyMember = teamMemberRepository.findByUserIdAndOrganizationId(saved.getId(), org.getId()).isPresent();
                if (!alreadyMember) {
                    com.neuroforge.backend.organization.entity.OrgRole orgRole = com.neuroforge.backend.organization.entity.OrgRole.DEVELOPER;
                    if ("ROLE_ORG_ADMIN".equals(req.getRole())) {
                        orgRole = com.neuroforge.backend.organization.entity.OrgRole.ORG_ADMIN;
                    } else if ("ROLE_PROJECT_MANAGER".equals(req.getRole())) {
                        orgRole = com.neuroforge.backend.organization.entity.OrgRole.PROJECT_MANAGER;
                    } else if ("ROLE_QA".equals(req.getRole())) {
                        orgRole = com.neuroforge.backend.organization.entity.OrgRole.QA;
                    } else if ("ROLE_CLIENT".equals(req.getRole())) {
                        orgRole = com.neuroforge.backend.organization.entity.OrgRole.CLIENT;
                    }

                    com.neuroforge.backend.organization.entity.TeamMember teamMember = com.neuroforge.backend.organization.entity.TeamMember.builder()
                            .user(saved)
                            .organization(org)
                            .role(orgRole)
                            .build();
                    teamMemberRepository.save(teamMember);
                }
            });
        }

        return ResponseEntity.ok(ApiResponse.ok("User created successfully", UserDTO.from(saved)));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ORG_ADMIN')")
    @Operation(summary = "List all users (Super Admin / Org Admin only)")
    public ResponseEntity<ApiResponse<List<UserDTO>>> listUsers() {
        List<UserDTO> users = userRepository.findAll()
                .stream().map(UserDTO::from).toList();
        return ResponseEntity.ok(ApiResponse.ok("Users retrieved", users));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ORG_ADMIN')")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<ApiResponse<UserDTO>> getUser(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(u -> ResponseEntity.ok(ApiResponse.ok("User found", UserDTO.from(u))))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @Operation(summary = "Delete a user (Super Admin only)")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found"));

        // Clear team lead reference if this user is a team lead
        teamRepository.clearTeamLead(id);

        // Clear code review references
        codeReviewRepository.clearApprovedBy(id);
        codeReviewRepository.deleteByRequestedBy(id);

        // Get all TeamMember records for this user first
        List<com.neuroforge.backend.organization.entity.TeamMember> teamMembers = teamMemberRepository.findByUserId(id);

        // Remove user from all project memberships for each TeamMember
        for (com.neuroforge.backend.organization.entity.TeamMember tm : teamMembers) {
            projectMemberRepository.deleteByTeamMemberId(tm.getId());
        }

        // Unassign user from tasks (set assignedTo to null)
        taskRepository.unassignTasksByUserId(id);

        // Delete TeamMember records for this user using bulk delete
        // This is more reliable than JPA deleteAll for foreign key constraints
        teamMemberRepository.deleteByUserId(id);

        // Delete all invitations for this user's email to prevent role conflicts on re-registration
        inviteRepository.deleteByEmail(user.getEmail());

        // Clear organization createdBy reference if this user created any organizations
        // This is needed to avoid foreign key constraint violations
        organizationRepository.clearCreatedBy(id);

        // Delete the user
        userRepository.deleteById(id);

        return ResponseEntity.ok(ApiResponse.ok("User deleted successfully from all systems"));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ORG_ADMIN')")
    @Operation(summary = "Approve or reject a user (Super Admin / Org Admin only)")
    @Transactional
    public ResponseEntity<ApiResponse<UserDTO>> approveUser(
            @PathVariable Long id,
            @Valid @RequestBody ApproveUserRequest req,
            @AuthenticationPrincipal User currentUser) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if ("APPROVE".equals(req.getAction())) {
            user.setApprovalStatus("APPROVED");
            user.setApprovedBy(currentUser.getId());
            user.setApprovedAt(java.time.LocalDateTime.now());

            // If user has an organizationId (from normal registration), create TeamMember record
            if (user.getOrganizationId() != null) {
                organizationRepository.findById(user.getOrganizationId()).ifPresent(org -> {
                    boolean alreadyMember = teamMemberRepository.findByUserIdAndOrganizationId(user.getId(), org.getId()).isPresent();
                    if (!alreadyMember) {
                        com.neuroforge.backend.organization.entity.OrgRole orgRole = com.neuroforge.backend.organization.entity.OrgRole.DEVELOPER;
                        if ("ROLE_ORG_ADMIN".equals(user.getRole())) {
                            orgRole = com.neuroforge.backend.organization.entity.OrgRole.ORG_ADMIN;
                        } else if ("ROLE_PROJECT_MANAGER".equals(user.getRole())) {
                            orgRole = com.neuroforge.backend.organization.entity.OrgRole.PROJECT_MANAGER;
                        } else if ("ROLE_QA".equals(user.getRole())) {
                            orgRole = com.neuroforge.backend.organization.entity.OrgRole.QA;
                        } else if ("ROLE_CLIENT".equals(user.getRole())) {
                            orgRole = com.neuroforge.backend.organization.entity.OrgRole.CLIENT;
                        }

                        com.neuroforge.backend.organization.entity.TeamMember teamMember = com.neuroforge.backend.organization.entity.TeamMember.builder()
                                .user(user)
                                .organization(org)
                                .role(orgRole)
                                .build();
                        teamMemberRepository.save(teamMember);
                    }
                });
            }
        } else if ("REJECT".equals(req.getAction())) {
            user.setApprovalStatus("REJECTED");
            user.setApprovedBy(currentUser.getId());
            user.setApprovedAt(java.time.LocalDateTime.now());
        } else {
            throw new RuntimeException("Invalid action. Must be APPROVE or REJECT");
        }

        User saved = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok("User approval status updated", UserDTO.from(saved)));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ORG_ADMIN')")
    @Operation(summary = "Get pending users awaiting approval")
    public ResponseEntity<ApiResponse<List<UserDTO>>> getPendingUsers(@AuthenticationPrincipal User currentUser) {
        List<User> pendingUsers;

        // Super Admin sees all pending users
        if ("ROLE_SUPER_ADMIN".equals(currentUser.getRole())) {
            pendingUsers = userRepository.findAll()
                    .stream()
                    .filter(u -> "PENDING".equals(u.getApprovalStatus()))
                    .toList();
        }
        // Org Admin sees pending users for their organization (from TeamMember or organizationId)
        else if ("ROLE_ORG_ADMIN".equals(currentUser.getRole())) {
            // Get organization IDs from TeamMember records
            List<Long> orgIdsFromTeamMember = new java.util.ArrayList<>(teamMemberRepository.findByUserId(currentUser.getId())
                    .stream()
                    .map(m -> m.getOrganization().getId())
                    .toList());

            // Also include organizationId if set (for Org Admins who are the org creator)
            if (currentUser.getOrganizationId() != null && !orgIdsFromTeamMember.contains(currentUser.getOrganizationId())) {
                orgIdsFromTeamMember.add(currentUser.getOrganizationId());
            }

            // If Org Admin has no organization, return empty list
            if (orgIdsFromTeamMember.isEmpty()) {
                pendingUsers = List.of();
            } else {
                final List<Long> finalOrgIds = orgIdsFromTeamMember;
                pendingUsers = userRepository.findAll()
                        .stream()
                        .filter(u -> "PENDING".equals(u.getApprovalStatus())
                                && u.getOrganizationId() != null
                                && finalOrgIds.contains(u.getOrganizationId()))
                        .toList();
            }
        }
        // Other roles return empty list
        else {
            pendingUsers = List.of();
        }

        List<UserDTO> users = pendingUsers.stream()
                .map(UserDTO::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok("Pending users retrieved", users));
    }
}
