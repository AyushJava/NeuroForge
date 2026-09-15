package com.neuroforge.backend.service.impl;

import com.neuroforge.backend.dto.*;
import com.neuroforge.backend.entity.Otp;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.organization.entity.Invite;
import com.neuroforge.backend.organization.entity.InviteStatus;
import com.neuroforge.backend.organization.entity.OrgRole;
import com.neuroforge.backend.organization.entity.TeamMember;
import com.neuroforge.backend.organization.repository.InviteRepository;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.organization.repository.TeamMemberRepository;
import com.neuroforge.backend.repository.OtpRepository;
import com.neuroforge.backend.repository.UserRepository;
import com.neuroforge.backend.security.JwtUtil;
import com.neuroforge.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository        userRepository;
    private final OtpRepository         otpRepository;
    private final PasswordEncoder       passwordEncoder;
    private final JwtUtil               jwtUtil;
    private final AuthenticationManager authManager;
    private final JavaMailSender        mailSender;
    private final InviteRepository      inviteRepository;
    private final TeamMemberRepository  teamMemberRepository;
    private final OrganizationRepository orgRepository;

    // ── Send OTP for registration ─────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<Void> sendOtp(OtpRequest request) {
        String email = request.getEmail();
        if (userRepository.existsByEmail(email)) {
            throw AppException.conflict("Email is already registered");
        }
        generateAndSendOtp(email, "NeuroForge — Email Verification",
                "Your registration OTP is: %s\nThis code expires in 5 minutes.");
        return ApiResponse.ok("OTP sent to " + email);
    }

    // ── Register ──────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<Void> register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw AppException.conflict("Email is already registered");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw AppException.conflict("Username is already taken");
        }

        verifyOtpCode(request.getEmail(), request.getOtp());

        // Determine role and approval requirement
        Object[] roleResult = determineRoleForRegistration(request.getEmail(), request.getRole());
        String assignedRole = (String) roleResult[0];
        boolean requiresApproval = (Boolean) roleResult[1];
        boolean hasInvitation = !requiresApproval; // If no approval required, it means user has invitation
        log.info("Assigning role {} to user {} during registration (approval required: {})", assignedRole, request.getEmail(), requiresApproval);

        // Validate organizationId for normal registration (no invitation)
        Long orgId = request.getOrganizationId();
        if (!hasInvitation) {
            // Normal registration: organizationId is required
            if (orgId == null) {
                throw AppException.badRequest("Organization selection is required for registration");
            }
            // Validate that the organization exists
            if (!orgRepository.existsById(orgId)) {
                throw AppException.notFound("Selected organization does not exist");
            }
            log.info("User {} registering with organizationId: {}", request.getEmail(), orgId);
        } else {
            // Invitation-based registration: clear organizationId from request
            // The organizationId will be set from the TeamMember relationship instead
            orgId = null;
            log.info("User {} registering via invitation, organizationId will be set from invitation", request.getEmail());
        }

        User user = User.builder()
                .name(request.getName())
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(assignedRole)
                .organizationId(orgId)
                .enabled(true)   // verified via OTP
                .approvalStatus(requiresApproval ? "PENDING" : "APPROVED")
                .build();

        userRepository.save(user);
        otpRepository.deleteAllByEmail(request.getEmail());

        // Materialise any TeamMember rows for invitations that were accepted
        // before this account existed (i.e. the user clicked Accept on the
        // invitation email and only registered afterwards).
        materialiseAcceptedInvitations(user);

        // If user registered with an organizationId but has no TeamMember, create one
        // This handles the case where a user registers directly with an organization
        if (orgId != null && assignedRole.equals("ROLE_PROJECT_MANAGER")) {
            boolean alreadyMember = teamMemberRepository.findByUserIdAndOrganizationId(user.getId(), orgId).isPresent();
            if (!alreadyMember) {
                TeamMember teamMember = TeamMember.builder()
                        .user(user)
                        .organization(orgRepository.findById(orgId).orElse(null))
                        .role(OrgRole.PROJECT_MANAGER)
                        .build();
                teamMemberRepository.save(teamMember);
                log.info("Created TeamMember for user {} in org {} during registration", user.getId(), orgId);
            }
        }

        return ApiResponse.ok("Registration successful. You can now log in.");
    }

    @Override
    public ApiResponse<InvitationCheckResponse> checkInvitation(String email) {
        try {
            List<Invite> acceptedInvites = inviteRepository.findByEmailAndStatus(
                    email, InviteStatus.ACCEPTED);
            if (!acceptedInvites.isEmpty()) {
                OrgRole inviteRole = acceptedInvites.get(0).getRole();
                String roleString = "ROLE_" + inviteRole.name();
                log.info("Found accepted invitation for {}, role: {}", email, roleString);
                return ApiResponse.ok("Invitation found", InvitationCheckResponse.builder()
                        .hasInvitation(true)
                        .role(roleString)
                        .build());
            }
            log.info("No accepted invitation found for {}", email);
            return ApiResponse.ok("No invitation", InvitationCheckResponse.builder()
                    .hasInvitation(false)
                    .role(null)
                    .build());
        } catch (Exception e) {
            log.error("Error checking invitation for {}: {}", email, e.getMessage());
            return ApiResponse.ok("No invitation", InvitationCheckResponse.builder()
                    .hasInvitation(false)
                    .role(null)
                    .build());
        }
    }

    /**
     * Determines the role to assign during registration.
     * If the user has an accepted invitation, use the role from the invitation (allows admin roles).
     * Otherwise, use the role from the request (for normal registration) and validate it's not an admin role.
     * If no invitation and no role in request, throw validation error.
     * Returns an array with [role, requiresApproval]
     */
    private Object[] determineRoleForRegistration(String email, String requestRole) {
        try {
            List<Invite> acceptedInvites = inviteRepository.findByEmailAndStatus(
                    email, InviteStatus.ACCEPTED);
            if (!acceptedInvites.isEmpty()) {
                // Use the role from the most recent accepted invitation
                // Admin roles are allowed from invitations and don't require approval
                OrgRole inviteRole = acceptedInvites.get(0).getRole();
                String roleString = "ROLE_" + inviteRole.name();
                log.info("Found accepted invitation for {}, assigning role from invitation: {}", email, roleString);
                return new Object[]{roleString, false};
            }
        } catch (Exception e) {
            log.error("Error checking for accepted invitations for {}: {}", email, e.getMessage());
        }
        // No invitation exists - role must be provided in request
        if (requestRole != null && !requestRole.trim().isEmpty()) {
            // Map role name to proper ROLE_ format
            String mappedRole = mapRoleToAuthority(requestRole);
            // Validate that role is not an admin role (only for normal registration)
            if (isRestrictedRole(mappedRole)) {
                log.error("Attempted to register with restricted role without invitation: {}", mappedRole);
                throw AppException.badRequest("Cannot register with admin roles. Admin roles are assigned through invitations only.");
            }
            // Non-admin roles require approval
            log.info("No invitation found for {}, using role from request: {} (mapped from {})", email, mappedRole, requestRole);
            return new Object[]{mappedRole, true};
        }
        // No invitation and no role provided - validation error
        log.error("No invitation and no request role for {}", email);
        throw AppException.badRequest("Please select a role");
    }

    /**
     * Checks if a role is restricted (admin roles that cannot be self-assigned).
     */
    private boolean isRestrictedRole(String role) {
        return "ROLE_SUPER_ADMIN".equals(role) ||
               "ROLE_ORG_ADMIN".equals(role) ||
               "ROLE_PROJECT_MANAGER".equals(role);
    }

    /**
     * Maps role names from frontend format to proper ROLE_ authority format.
     * Handles both already-formatted roles (ROLE_XXX) and short names (QA, Developer, etc.)
     */
    private String mapRoleToAuthority(String role) {
        if (role == null || role.trim().isEmpty()) {
            return "ROLE_DEVELOPER"; // Default fallback
        }
        
        // If already in ROLE_ format, return as-is
        if (role.startsWith("ROLE_")) {
            return role;
        }
        
        // Map short names to proper ROLE_ format
        return switch (role.toLowerCase()) {
            case "qa", "tester" -> "ROLE_TESTER";
            case "developer", "dev" -> "ROLE_DEVELOPER";
            case "client" -> "ROLE_CLIENT";
            case "project manager", "pm" -> "ROLE_PROJECT_MANAGER";
            case "org admin", "organization admin" -> "ROLE_ORG_ADMIN";
            case "super admin", "superadmin" -> "ROLE_SUPER_ADMIN";
            default -> "ROLE_" + role.toUpperCase();
        };
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Override
    public ApiResponse<LoginResponse> login(LoginRequest request) {
        // Throws BadCredentialsException / DisabledException — caught by GlobalExceptionHandler
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> AppException.notFound("User not found"));

        // Check approval status
        String approvalStatus = user.getApprovalStatus();
        if ("PENDING".equals(approvalStatus)) {
            throw AppException.forbidden("Your account is awaiting organization administrator approval.");
        }
        if ("REJECTED".equals(approvalStatus)) {
            throw AppException.forbidden("Your account has been rejected. Please contact your organization administrator.");
        }

        LoginResponse resp = LoginResponse.builder()
                .accessToken(jwtUtil.generateAccessToken(user))
                .refreshToken(jwtUtil.generateRefreshToken(user))
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .username(user.getUsername())
                .role(user.getRole())
                .organizationId(user.getOrganizationId())
                .build();

        return ApiResponse.ok("Login successful", resp);
    }

    // ── Logout (stateless — just an ack) ─────────────────────────────────────

    @Override
    public ApiResponse<Void> logout(String email) {
        return ApiResponse.ok("Logged out successfully");
    }

    // ── Forgot password OTP ───────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<Void> sendForgotPasswordOtp(OtpRequest request) {
        String email = request.getEmail();
        if (!userRepository.existsByEmail(email)) {
            // Don't reveal whether the email exists
            return ApiResponse.ok("If that email is registered, an OTP has been sent.");
        }
        generateAndSendOtp(email, "NeuroForge — Password Reset",
                "Your password reset OTP is: %s\nThis code expires in 5 minutes.");
        return ApiResponse.ok("OTP sent to " + email);
    }

    // ── Verify OTP only (for multi-step flows) ────────────────────────────────

    @Override
    public ApiResponse<Void> verifyOtp(VerifyOtpRequest request) {
        verifyOtpCode(request.getEmail(), request.getOtp());
        return ApiResponse.ok("OTP verified successfully");
    }

    // ── Reset password ────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ApiResponse<Void> resetPassword(ResetPasswordRequest request) {
        verifyOtpCode(request.getEmail(), request.getOtp());

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> AppException.notFound("User not found"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        otpRepository.deleteAllByEmail(request.getEmail());

        return ApiResponse.ok("Password reset successful. You can now log in.");
    }

    // ── Refresh token ─────────────────────────────────────────────────────────

    @Override
    public ApiResponse<LoginResponse> refreshToken(RefreshTokenRequest request) {
        String token = request.getRefreshToken();
        if (!jwtUtil.isTokenValid(token)) {
            throw AppException.unauthorized("Invalid or expired refresh token");
        }
        String email = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("User not found"));

        // Check approval status
        String approvalStatus = user.getApprovalStatus();
        if ("PENDING".equals(approvalStatus)) {
            throw AppException.forbidden("Your account is awaiting organization administrator approval.");
        }
        if ("REJECTED".equals(approvalStatus)) {
            throw AppException.forbidden("Your account has been rejected. Please contact your organization administrator.");
        }

        LoginResponse resp = LoginResponse.builder()
                .accessToken(jwtUtil.generateAccessToken(user))
                .refreshToken(jwtUtil.generateRefreshToken(user))
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .username(user.getUsername())
                .role(user.getRole())
                .organizationId(user.getOrganizationId())
                .build();

        return ApiResponse.ok("Token refreshed", resp);
    }

    // ── Me ────────────────────────────────────────────────────────────────────

    @Override
    public ApiResponse<UserDTO> me(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("User not found"));
        return ApiResponse.ok("User details", UserDTO.from(user));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * After a new user registers, check whether any invitations addressed to
     * their email were already accepted (i.e. the user accepted the link before
     * creating an account).  For each such invitation, create the corresponding
     * {@link TeamMember} row so they immediately appear in the organisation's
     * Members list.
     */
    private void materialiseAcceptedInvitations(User user) {
        try {
            List<Invite> accepted = inviteRepository.findByEmailAndStatus(
                    user.getEmail(), InviteStatus.ACCEPTED);
            log.info("Found {} accepted invitations for email {}", accepted.size(), user.getEmail());
            
            for (Invite invite : accepted) {
                try {
                    boolean alreadyMember = teamMemberRepository
                            .findByUserIdAndOrganizationId(user.getId(), invite.getOrganization().getId())
                            .isPresent();
                    if (!alreadyMember) {
                        TeamMember teamMember = TeamMember.builder()
                                .user(user)
                                .organization(invite.getOrganization())
                                .role(invite.getRole())
                                .build();
                        teamMemberRepository.save(teamMember);
                        log.info("Created TeamMember for {} in org {} from accepted invitation",
                                user.getEmail(), invite.getOrganization().getId());
                    } else {
                        log.info("User {} is already a member of org {}", user.getEmail(), invite.getOrganization().getId());
                    }
                    
                    // Set the user's organizationId to the invited organization if not already set
                    // This ensures the JWT contains the correct organization context
                    if (user.getOrganizationId() == null) {
                        user.setOrganizationId(invite.getOrganization().getId());
                        userRepository.save(user);
                        log.info("Set organizationId {} for user {} from accepted invitation", 
                                invite.getOrganization().getId(), user.getEmail());
                    }
                } catch (Exception e) {
                    log.error("Failed to create TeamMember for invitation {}: {}", invite.getId(), e.getMessage(), e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to materialise accepted invitations for {}: {}", user.getEmail(), e.getMessage(), e);
        }
    }

    private void generateAndSendOtp(String email, String subject, String bodyTemplate) {
        otpRepository.deleteAllByEmail(email);

        String code = String.format("%06d", new Random().nextInt(1_000_000));
        Otp otp = Otp.builder()
                .email(email)
                .otp(code)
                .expiryTime(LocalDateTime.now().plusMinutes(5))
                .build();
        otpRepository.save(otp);

        sendEmail(email, subject, String.format(bodyTemplate, code));
        log.info("OTP sent to {}", email);
    }

    private void verifyOtpCode(String email, String code) {
        Otp otp = otpRepository.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> AppException.badRequest("No OTP found for this email. Please request one."));

        if (otp.isUsed())    throw AppException.badRequest("OTP has already been used");
        if (otp.isExpired()) throw AppException.badRequest("OTP has expired. Please request a new one.");
        if (!otp.getOtp().equals(code)) throw AppException.badRequest("Invalid OTP");

        otp.setUsed(true);
        otpRepository.save(otp);
    }

    private void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw AppException.badRequest("Failed to send email. Please try again.");
        }
    }
}
