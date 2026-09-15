package com.neuroforge.backend.specification.service.impl;

import com.neuroforge.backend.exception.AppException;
import com.neuroforge.backend.organization.entity.Organization;
import com.neuroforge.backend.organization.repository.OrganizationRepository;
import com.neuroforge.backend.security.SecurityUtils;
import com.neuroforge.backend.specification.dto.request.CreateSpecificationRequest;
import com.neuroforge.backend.specification.dto.request.SaveAISpecificationRequest;
import com.neuroforge.backend.specification.dto.request.UpdateSpecificationRequest;
import com.neuroforge.backend.specification.dto.response.SpecificationResponse;
import com.neuroforge.backend.specification.dto.response.SpecificationVersionResponse;
import com.neuroforge.backend.specification.entity.AISpecification;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.entity.SpecificationVersion;
import com.neuroforge.backend.specification.enums.SpecificationStatus;
import com.neuroforge.backend.specification.enums.VersionStatus;
import com.neuroforge.backend.specification.exception.BadRequestException;
import com.neuroforge.backend.specification.exception.DuplicateSpecificationException;
import com.neuroforge.backend.specification.exception.ResourceNotFoundException;
import com.neuroforge.backend.specification.exception.SpecificationNotFoundException;
import com.neuroforge.backend.specification.mapper.SpecificationMapper;
import com.neuroforge.backend.specification.repository.AISpecificationRepository;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import com.neuroforge.backend.specification.service.SpecificationService;
import com.neuroforge.backend.notification.service.NotificationService;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class SpecificationServiceImpl implements SpecificationService {

    private final SpecificationRepository specificationRepository;
    private final SpecificationMapper specificationMapper;
    private final AISpecificationRepository aiSpecificationRepository;
    private final OrganizationRepository organizationRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Override
    public SpecificationResponse createSpecification(CreateSpecificationRequest request) {

        String title = request.getTitle().trim();

        log.debug("Validating duplicate title: {}", title);

        validateDuplicateTitle(title);
        validateCreationRequest(request);

        Specification specification = buildSpecification(title);

        // Set organization if provided
        if (request.getOrganizationId() != null) {
            Organization organization = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
            specification.setOrganization(organization);
        }

        // Set project if provided
        if (request.getProjectId() != null) {
            try {
                specification.setProjectId(UUID.fromString(request.getProjectId()));
            } catch (Exception e) {
                log.warn("Invalid projectId format: {}", request.getProjectId());
            }
        }

        SpecificationVersion version = buildManualVersion(
                specification,
                request.getDescription(),
                request.getUserStories(),
                request.getAcceptanceCriteria(),
                request.getFunctionalRequirements(),
                request.getNonFunctionalRequirements(),
                1
        );

        specification.addVersion(version);

        specification = specificationRepository.save(specification);

        log.info("Specification created successfully | id={} | key={} | version={} | status={} | orgId={}",
                specification.getId(),
                specification.getSpecificationKey(),
                specification.getCurrentVersion(),
                specification.getStatus(),
                specification.getOrganization() != null ? specification.getOrganization().getId() : null
        );

        // Notify organization members about new specification
        if (specification.getOrganization() != null) {
            notifyOrganizationMembers(specification.getOrganization().getId(), 
                "New Specification Created", 
                "Specification \"" + specification.getTitle() + "\" has been created and is ready for review.",
                "SPECIFICATION");
        }

        return specificationMapper.toResponse(specification);
    }

    @Override
    @Transactional(readOnly = true)
    public SpecificationResponse getSpecification(UUID specificationId) {

        Specification specification = getSpecificationOrThrow(specificationId);

        // Validate organization membership (IDOR protection)
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganization() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        log.debug("Specification retrieved | id={} | version={} | status={}",
                specification.getId(),
                specification.getCurrentVersion(),
                specification.getStatus()
        );

        return specificationMapper.toResponse(specification);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SpecificationResponse> getAllSpecifications(
            String title,
            SpecificationStatus status,
            Long orgId,
            Pageable pageable) {
        log.debug("Fetching all specifications | title={} | status={} | orgId={}", title, status, orgId);

        Page<Specification> specifications;
        
        if (orgId != null) {
            // Organization-scoped queries
            if (title != null && !title.isBlank() && status != null) {
                specifications = specificationRepository
                        .findByDeletedFalseAndTitleContainingIgnoreCaseAndStatusAndOrganizationId(
                                title.trim(),
                                status,
                                orgId,
                                pageable
                        );
            } else if (title != null && !title.isBlank()) {
                specifications = specificationRepository
                        .findByDeletedFalseAndTitleContainingIgnoreCaseAndOrganizationId(
                                title.trim(),
                                orgId,
                                pageable
                        );
            } else if (status != null) {
                specifications = specificationRepository
                        .findByDeletedFalseAndStatusAndOrganizationId(
                                status,
                                orgId,
                                pageable
                        );
            } else {
                specifications = specificationRepository
                        .findByDeletedFalseAndOrganizationId(orgId, pageable);
            }
        } else {
            // No organization filter (existing behavior)
            if (title != null && !title.isBlank() && status != null) {
                specifications = specificationRepository
                        .findByDeletedFalseAndTitleContainingIgnoreCaseAndStatus(
                                title.trim(),
                                status,
                                pageable
                        );
            } else if (title != null && !title.isBlank()) {
                specifications = specificationRepository
                        .findByDeletedFalseAndTitleContainingIgnoreCase(
                                title.trim(),
                                pageable
                        );
            } else if (status != null) {
                specifications = specificationRepository
                        .findByDeletedFalseAndStatus(
                                status,
                                pageable
                        );
            } else {
                specifications = specificationRepository
                        .findByDeletedFalse(pageable);
            }
        }

        return specifications.map(specificationMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SpecificationResponse> getApprovedSpecificationsByProject(Long projectId, Pageable pageable) {
        // Since Specification.projectId is UUID and Project.id is Long, we cannot directly query by project ID
        // We'll filter by organization ID and APPROVED status as a workaround
        Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                .orElseThrow(() -> AppException.forbidden("User has no organization"));

        log.debug("Fetching approved specifications for organization | orgId={}", userOrgId);

        Page<Specification> specifications = specificationRepository
                .findByDeletedFalseAndStatusAndOrganizationId(
                        SpecificationStatus.APPROVED, 
                        userOrgId, 
                        pageable
                );

        return specifications.map(specificationMapper::toResponse);
    }

    @Override
    public SpecificationResponse updateSpecification(
            UUID id,
            UpdateSpecificationRequest request) {

        Specification specification = getSpecificationOrThrow(id);

        // Validate organization membership
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganization() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        int nextVersion = specification.getCurrentVersion() + 1;

        validateField(request.getDescription(), "Description");
        validateField(request.getUserStories(), "User Stories");
        validateField(request.getAcceptanceCriteria(), "Acceptance Criteria");
        validateField(request.getFunctionalRequirements(), "Functional Requirements");
        validateField(request.getNonFunctionalRequirements(), "Non Functional Requirements");

        SpecificationVersion version = buildManualVersion(
                specification,
                request.getDescription(),
                request.getUserStories(),
                request.getAcceptanceCriteria(),
                request.getFunctionalRequirements(),
                request.getNonFunctionalRequirements(),
                nextVersion
        );

        specification.addVersion(version);
        specification.setCurrentVersion(nextVersion);

        specification = specificationRepository.save(specification);

        log.info("Specification updated successfully | id={} | newVersion={} | status={}",
                specification.getId(),
                specification.getCurrentVersion(),
                specification.getStatus()
        );

        return specificationMapper.toResponse(specification);
    }

    @Override
    public void deleteSpecification(UUID id) {

        Specification specification = getSpecificationOrThrow(id);

        // Validate organization membership
        if (!SecurityUtils.isSuperAdmin() && specification.getOrganization() != null) {
            Long userOrgId = SecurityUtils.getCurrentUserOrganizationId()
                    .orElseThrow(() -> AppException.forbidden("User has no organization"));
            if (!specification.getOrganization().getId().equals(userOrgId)) {
                throw AppException.forbidden("Access denied: specification belongs to a different organization");
            }
        }

        specification.setDeleted(true);

        specificationRepository.save(specification);

        log.info("Specification soft deleted successfully | id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public SpecificationVersionResponse getApprovedVersion(UUID specificationId) {

        Specification specification =
                specificationRepository.findByIdAndDeletedFalse(specificationId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Specification not found"));

        SpecificationVersion version =
                specification.getVersions()
                        .stream()
                        .filter(v -> v.getStatus() == VersionStatus.APPROVED)
                        .max(Comparator.comparingInt(
                                SpecificationVersion::getVersionNumber))
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "No approved version found"));

        return specificationMapper.toResponse(version);
    }

    private Specification buildSpecification(String title) {

        log.debug("Building new Specification entity");

        return Specification.builder()
                .specificationKey(generateSpecificationKey())
                .title(title)
                .currentVersion(1)
                .status(SpecificationStatus.DRAFT)
                .deleted(false)
                .build();
    }

    private SpecificationVersion buildManualVersion(
            Specification specification,
            String description,
            String userStories,
            String acceptanceCriteria,
            String functionalRequirements,
            String nonFunctionalRequirements,
            Integer versionNumber) {

        log.debug("Creating specification version | fromVersion={} | toVersion={}",
                versionNumber - 1,
                versionNumber
        );

        return SpecificationVersion.builder()
                .specification(specification)
                .versionNumber(versionNumber)
                .description(description != null ? description.trim() : "")
                .userStories(userStories != null ? userStories.trim() : null)
                .acceptanceCriteria(acceptanceCriteria != null ? acceptanceCriteria.trim() : null)
                .functionalRequirements(functionalRequirements != null ? functionalRequirements.trim() : null)
                .nonFunctionalRequirements(nonFunctionalRequirements != null ? nonFunctionalRequirements.trim() : null)
                .status(VersionStatus.DRAFT)
                .generatedBy("MANUAL")
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private Specification getSpecificationOrThrow(UUID id) {

        return specificationRepository
                .findByIdAndDeletedFalse(id)
                .orElseThrow(() -> {

                    log.warn("Specification not found | id={}", id);

                    return new SpecificationNotFoundException(
                            "Specification not found with id : " + id
                    );
                });
    }

    private void validateDuplicateTitle(String title) {

        log.debug("Validating duplicate title: {}", title);

        if (specificationRepository.existsByTitleIgnoreCase(title)) {

            log.warn("Duplicate specification title found: {}", title);

            throw new DuplicateSpecificationException(
                    "Specification already exists with title : " + title
            );
        }

        log.debug("Title validation successful: {}", title);
    }

    private String generateSpecificationKey() {

        long count = specificationRepository.count() + 1;
        long sequence = (count * 1000L + (System.currentTimeMillis() % 1000L)) % 1000000L;

        String key = String.format("SPEC-%06d", sequence);

        log.debug("Generated specification key | key={}", key);

        return key;
    }

    private void validateCreationRequest(CreateSpecificationRequest request) {
        validateField(request.getDescription(), "Description");
        validateField(request.getUserStories(), "User Stories");
        validateField(request.getAcceptanceCriteria(), "Acceptance Criteria");
        validateField(request.getFunctionalRequirements(), "Functional Requirements");
        validateField(request.getNonFunctionalRequirements(), "Non Functional Requirements");
    }

    private void validateField(String value, String fieldName) {

        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required.");
        }
    }

    // ── Module 4: Save AI-generated specification ─────────────────────────────

    @Override
    public SpecificationResponse saveAISpecification(SaveAISpecificationRequest request) {

        String title = request.getTitle().trim();

        log.info("Saving AI-generated specification | title={}", title);

        validateDuplicateTitle(title);

        // Build specification
        Specification specification = buildSpecification(title);

        // Set organization if provided
        if (request.getOrganizationId() != null) {
            try {
                Organization organization = organizationRepository.findById(request.getOrganizationId())
                        .orElse(null);
                if (organization != null) {
                    specification.setOrganization(organization);
                }
            } catch (Exception e) {
                log.warn("Failed to set organization for specification: {}", e.getMessage());
            }
        }

        // Set project if provided
        if (request.getProjectId() != null) {
            try {
                specification.setProjectId(UUID.fromString(request.getProjectId()));
            } catch (Exception e) {
                log.warn("Invalid projectId format: {}", request.getProjectId());
            }
        }

        // Convert lists to strings for storage
        String userStoriesStr = request.getUserStories() != null ? String.join("\n", request.getUserStories()) : null;
        String acceptanceCriteriaStr = request.getAcceptanceCriteria() != null ? String.join("\n", request.getAcceptanceCriteria()) : null;
        String functionalRequirementsStr = request.getFunctionalRequirements() != null ? String.join("\n", request.getFunctionalRequirements()) : null;
        String nonFunctionalRequirementsStr = request.getNonFunctionalRequirements() != null ? String.join("\n", request.getNonFunctionalRequirements()) : null;

        // Build AI-generated version
        SpecificationVersion version = buildAIVersion(
                specification,
                request.getDescription(),
                userStoriesStr,
                acceptanceCriteriaStr,
                functionalRequirementsStr,
                nonFunctionalRequirementsStr,
                1
        );

        specification.addVersion(version);
        specification = specificationRepository.save(specification);

        // Link MongoDB AI record if provided
        if (request.getAiSpecificationId() != null) {
            try {
                AISpecification aiSpec = aiSpecificationRepository.findById(request.getAiSpecificationId()).orElse(null);
                if (aiSpec != null) {
                    aiSpec.setSpecificationId(specification.getId());
                    aiSpec.setVersionId(version.getId());
                    aiSpecificationRepository.save(aiSpec);
                    log.info("Linked AI specification to MongoDB | specId={} | versionId={} | aiId={}",
                            specification.getId(), version.getId(), request.getAiSpecificationId());
                }
            } catch (Exception e) {
                log.warn("Failed to link AI specification to MongoDB | aiId={}", request.getAiSpecificationId(), e);
                // Non-critical - continue without linking
            }
        }

        log.info("AI-generated specification saved successfully | id={} | key={} | version={} | status={} | orgId={}",
                specification.getId(),
                specification.getSpecificationKey(),
                specification.getCurrentVersion(),
                specification.getStatus(),
                specification.getOrganization() != null ? specification.getOrganization().getId() : null
        );

        return specificationMapper.toResponse(specification);
    }

    private SpecificationVersion buildAIVersion(
            Specification specification,
            String description,
            String userStories,
            String acceptanceCriteria,
            String functionalRequirements,
            String nonFunctionalRequirements,
            Integer versionNumber) {

        log.debug("Creating AI-generated specification version | version={}", versionNumber);

        return SpecificationVersion.builder()
                .specification(specification)
                .versionNumber(versionNumber)
                .description(description != null ? description.trim() : "")
                .userStories(userStories != null ? userStories.trim() : null)
                .acceptanceCriteria(acceptanceCriteria != null ? acceptanceCriteria.trim() : null)
                .functionalRequirements(functionalRequirements != null ? functionalRequirements.trim() : null)
                .nonFunctionalRequirements(nonFunctionalRequirements != null ? nonFunctionalRequirements.trim() : null)
                .status(VersionStatus.DRAFT)
                .generatedBy("AI")
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private void notifyOrganizationMembers(Long organizationId, String title, String message, String type) {
        try {
            List<User> orgMembers = userRepository.findByOrganizationId(organizationId);
            for (User member : orgMembers) {
                notificationService.create(member, title, message, type);
            }
        } catch (Exception e) {
            log.warn("Failed to notify organization members: {}", e.getMessage());
        }
    }

}
