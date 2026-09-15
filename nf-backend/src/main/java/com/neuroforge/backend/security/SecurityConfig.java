package com.neuroforge.backend.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final CustomUserDetailsService userDetailsService;

    private static final String[] PUBLIC_PATHS = {
        "/auth/**",
        "/favicon.ico",
        "/api/invitations/accept",
        "/api/invitations/reject",
        "/api/invitations/validate",
        "/api/organizations/public",
        "/swagger-ui/**",
        "/swagger-ui.html",
        "/api-docs/**",
        "/v3/api-docs/**",
        "/error",
        "/ws/**",
        "/pipeline-ws/**"
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PUBLIC_PATHS).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Super admin only
                .requestMatchers("/api/admin/**").hasAuthority("ROLE_SUPER_ADMIN")

                // Org management
                .requestMatchers("/api/organizations/**").hasAnyAuthority(
                        "ROLE_SUPER_ADMIN", "ROLE_ORG_ADMIN", "ROLE_PROJECT_MANAGER")

                // Invitation management (send/list/cancel) — org-level protected
                .requestMatchers("/api/invitations/**").authenticated()

                // Current user profile & preferences — any authenticated user
                .requestMatchers("/api/users/me/**").authenticated()
                .requestMatchers("/api/users/me").authenticated()

                // Notifications — any authenticated user
                .requestMatchers("/api/notifications/**").authenticated()

                // Global search — any authenticated user
                .requestMatchers("/api/search/**").authenticated()

                // Dashboard — all authenticated users
                .requestMatchers("/api/dashboard/**").authenticated()

                // Project management — all authenticated users can READ; writes restricted via @PreAuthorize
                .requestMatchers(HttpMethod.GET, "/api/projects/**").authenticated()
                .requestMatchers("/api/projects/**").hasAnyAuthority(
                        "ROLE_SUPER_ADMIN", "ROLE_PROJECT_MANAGER")

                // Sprint management — all roles can READ; writes restricted via @PreAuthorize
                .requestMatchers("/api/sprints/**").authenticated()

                // Task management — all authenticated users can READ; writes restricted via @PreAuthorize
                .requestMatchers(HttpMethod.GET, "/api/tasks/**").authenticated()
                .requestMatchers("/api/tasks/**").hasAnyAuthority(
                        "ROLE_SUPER_ADMIN", "ROLE_ORG_ADMIN", "ROLE_PROJECT_MANAGER",
                        "ROLE_DEVELOPER", "ROLE_QA")

                // Project member management — all roles can READ (GET); writes via @PreAuthorize
                .requestMatchers("/api/project-members/**").authenticated()

                // Specification management — all authenticated users can READ; writes restricted via @PreAuthorize
                .requestMatchers(HttpMethod.GET, "/api/specifications/**").authenticated()
                .requestMatchers("/api/specifications/**").authenticated()

                // User admin list — super admin / org admin only
                .requestMatchers("/api/users/**").hasAnyAuthority("ROLE_SUPER_ADMIN", "ROLE_ORG_ADMIN")

                // Repository integration — PM can manage, all authenticated can read commits
                .requestMatchers(HttpMethod.GET, "/api/repositories/**").authenticated()
                .requestMatchers("/api/repositories/**").hasAnyAuthority(
                        "ROLE_SUPER_ADMIN", "ROLE_ORG_ADMIN", "ROLE_PROJECT_MANAGER")

                // Module 9: CI/CD Pipeline — all authenticated users can read; PM can manage
                .requestMatchers(HttpMethod.GET, "/api/pipelines/**").authenticated()
                .requestMatchers("/api/pipelines/**").hasAnyAuthority("ROLE_PROJECT_MANAGER")

                // Module 8: Code Review — Developers can create/request reviews, PMs can view and approve/reject
                .requestMatchers(HttpMethod.GET, "/api/code-reviews/**").hasAnyAuthority("ROLE_DEVELOPER", "ROLE_PROJECT_MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/reviews/**").hasAnyAuthority("ROLE_DEVELOPER", "ROLE_PROJECT_MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/code-reviews").hasAuthority("ROLE_DEVELOPER")
                .requestMatchers(HttpMethod.POST, "/api/reviews/analyze").hasAuthority("ROLE_DEVELOPER")
                .requestMatchers(HttpMethod.PATCH, "/api/code-reviews/**").hasAuthority("ROLE_PROJECT_MANAGER")
                .requestMatchers(HttpMethod.DELETE, "/api/code-reviews/**").hasAnyAuthority("ROLE_DEVELOPER", "ROLE_PROJECT_MANAGER")

                // Module 14: Analytics — role-based access controlled via @PreAuthorize on endpoints
                .requestMatchers("/api/analytics/**").authenticated()

                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
