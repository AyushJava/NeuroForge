package com.neuroforge.backend.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;

public class SecurityUtils {

    public static Optional<Long> getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (userDetails instanceof com.neuroforge.backend.entity.User) {
                return Optional.of(((com.neuroforge.backend.entity.User) userDetails).getId());
            }
        }
        return Optional.empty();
    }

    public static Optional<com.neuroforge.backend.entity.User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (userDetails instanceof com.neuroforge.backend.entity.User) {
                return Optional.of((com.neuroforge.backend.entity.User) userDetails);
            }
        }
        return Optional.empty();
    }

    public static Optional<String> getCurrentUserRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (userDetails instanceof com.neuroforge.backend.entity.User) {
                return Optional.of(((com.neuroforge.backend.entity.User) userDetails).getRole());
            }
        }
        return Optional.empty();
    }

    public static Optional<Long> getCurrentUserOrganizationId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (userDetails instanceof com.neuroforge.backend.entity.User) {
                return Optional.ofNullable(((com.neuroforge.backend.entity.User) userDetails).getOrganizationId());
            }
        }
        return Optional.empty();
    }

    public static boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            if (userDetails instanceof com.neuroforge.backend.entity.User) {
                return role.equals(((com.neuroforge.backend.entity.User) userDetails).getRole());
            }
        }
        return false;
    }

    public static boolean isSuperAdmin() {
        return hasRole("ROLE_SUPER_ADMIN");
    }

    public static boolean isOrgAdmin() {
        return hasRole("ROLE_ORG_ADMIN");
    }

    public static boolean isProjectManager() {
        return hasRole("ROLE_PROJECT_MANAGER");
    }

    public static boolean isDeveloper() {
        return hasRole("ROLE_DEVELOPER");
    }

    public static boolean isQA() {
        return hasRole("ROLE_QA");
    }

    public static boolean isClient() {
        return hasRole("ROLE_CLIENT");
    }
}
