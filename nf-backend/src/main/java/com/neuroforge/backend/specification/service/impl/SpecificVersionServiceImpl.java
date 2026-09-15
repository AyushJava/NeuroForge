package com.neuroforge.backend.specification.service.impl;

import com.neuroforge.backend.specification.dto.request.RejectVersionRequest;
import com.neuroforge.backend.specification.dto.request.UpdateVersionRequest;
import com.neuroforge.backend.specification.dto.response.CompareVersionResponse;
import com.neuroforge.backend.specification.dto.response.FieldChangeResponse;
import com.neuroforge.backend.specification.dto.response.SpecificationVersionResponse;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.entity.SpecificationVersion;
import com.neuroforge.backend.specification.enums.SpecificationStatus;
import com.neuroforge.backend.specification.enums.VersionStatus;
import com.neuroforge.backend.specification.exception.InvalidWorkflowStateException;
import com.neuroforge.backend.specification.exception.SpecificationNotFoundException;
import com.neuroforge.backend.specification.mapper.SpecificationMapper;
import com.neuroforge.backend.specification.repository.SpecificationRepository;
import com.neuroforge.backend.specification.repository.SpecificationVersionRepository;
import com.neuroforge.backend.specification.service.SpecificVersionService;
import com.neuroforge.backend.notification.service.NotificationService;
import com.neuroforge.backend.entity.User;
import com.neuroforge.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class SpecificVersionServiceImpl implements SpecificVersionService {

    private final SpecificationVersionRepository versionRepository;
    private final SpecificationRepository specificationRepository;
    private final SpecificationMapper specificationMapper;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SpecificationVersionResponse> getVersions(UUID specificationId) {

        log.debug("Fetch Version List Request | specificationId={}", specificationId);

        List<SpecificationVersionResponse> versions = versionRepository
                .findBySpecificationIdOrderByVersionNumberDesc(specificationId)
                .stream()
                .map(specificationMapper::toResponse)
                .toList();

        log.debug("Version List fetched | specificationId={} | count={}", specificationId, versions.size());

        return versions;
    }

    @Override
    @Transactional(readOnly = true)
    public SpecificationVersionResponse getVersion(
            UUID specificationId,
            Integer versionNumber) {

        log.debug("Fetch Specification Version Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        log.debug("Specification Version fetched | specificationId={} | version={}", specificationId, versionNumber);

        return specificationMapper.toResponse(version);
    }

    @Override
    @Transactional(readOnly = true)
    public SpecificationVersionResponse getLatestVersion(UUID specificationId) {

        log.debug("Fetch Latest Specification Version Request | specificationId={}", specificationId);

        SpecificationVersion version = versionRepository
                .findTopBySpecificationIdOrderByVersionNumberDesc(specificationId)
                .orElseThrow(() -> {

                    log.warn("Specification not found | id={}", specificationId);

                    return new SpecificationNotFoundException(
                            "No version found for specification : " + specificationId
                    );
                });

        log.debug("Latest Specification Version fetched | specificationId={} | version={}", specificationId, version.getVersionNumber());

        return specificationMapper.toResponse(version);
    }

    @Override
    public SpecificationVersionResponse createNewVersion(UUID specificationId) {
        log.debug("Create New Version Request | specificationId={}", specificationId);

        // Fetch the specification entity
        Specification specification = specificationRepository.findById(specificationId)
                .orElseThrow(() -> new SpecificationNotFoundException("Specification not found: " + specificationId));

        // Get the latest version to determine the next version number
        SpecificationVersion latestVersion = versionRepository
                .findTopBySpecificationIdOrderByVersionNumberDesc(specificationId)
                .orElse(null);

        Integer nextVersionNumber = (latestVersion != null) ? latestVersion.getVersionNumber() + 1 : 1;

        // Create new version based on latest version (if exists)
        SpecificationVersion newVersion = SpecificationVersion.builder()
                .specification(specification)
                .versionNumber(nextVersionNumber)
                .status(com.neuroforge.backend.specification.enums.VersionStatus.DRAFT)
                .description(latestVersion != null ? latestVersion.getDescription() : "")
                .userStories(latestVersion != null ? latestVersion.getUserStories() : "")
                .acceptanceCriteria(latestVersion != null ? latestVersion.getAcceptanceCriteria() : "")
                .functionalRequirements(latestVersion != null ? latestVersion.getFunctionalRequirements() : "")
                .nonFunctionalRequirements(latestVersion != null ? latestVersion.getNonFunctionalRequirements() : "")
                .build();

        newVersion = versionRepository.save(newVersion);

        log.info("New version created successfully | specificationId={} | version={}", specificationId, nextVersionNumber);

        return specificationMapper.toResponse(newVersion);
    }

    @Override
    public SpecificationVersionResponse submitForReview(
            UUID specificationId,
            Integer versionNumber) {
        log.debug("Submit Version for Review Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        validateStatus(
                version,
                VersionStatus.DRAFT,
                "submitted for review"
        );

        version.setStatus(VersionStatus.IN_REVIEW);
        if (version.getSpecification() != null) {
            version.getSpecification().setStatus(SpecificationStatus.IN_REVIEW);
        }

        version = versionRepository.save(version);

        log.info("Version submitted for review | specificationId={} | version={} | status={}", specificationId, versionNumber, version.getStatus());
        return specificationMapper.toResponse(version);
    }

    @Override
    public SpecificationVersionResponse approveVersion(
            UUID specificationId,
            Integer versionNumber) {

        log.debug("Approve Version Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        validateStatus(
                version,
                VersionStatus.IN_REVIEW,
                "approved"
        );

        version.setStatus(VersionStatus.APPROVED);
        if (version.getSpecification() != null) {
            version.getSpecification().setStatus(SpecificationStatus.APPROVED);
        }
        version.setApprovedAt(LocalDateTime.now());

        version = versionRepository.save(version);

        log.info("Version approved successfully | specificationId={} | version={} | status={}", specificationId, versionNumber, version.getStatus());

        // Notify organization members about approval
        if (version.getSpecification() != null && version.getSpecification().getOrganizationId() != null) {
            notifyOrganizationMembers(version.getSpecification().getOrganizationId(),
                "Specification Approved",
                "Specification \"" + version.getSpecification().getTitle() + "\" version " + versionNumber + " has been approved.",
                "SPECIFICATION");
        }

        return specificationMapper.toResponse(version);
    }

    @Override
    public SpecificationVersionResponse rejectVersion(
            UUID specificationId,
            Integer versionNumber,
            RejectVersionRequest request) {

        log.debug("Reject Version Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        validateStatus(
                version,
                VersionStatus.IN_REVIEW,
                "rejected"
        );

        version.setStatus(VersionStatus.REJECTED);
        if (version.getSpecification() != null) {
            version.getSpecification().setStatus(SpecificationStatus.REJECTED);
        }
        version.setReviewedAt(LocalDateTime.now());
        version.setReviewComments(request.getComment());

        version = versionRepository.save(version);

        log.info("Version rejected successfully | specificationId={} | version={} | status={}", specificationId, versionNumber, version.getStatus());
        return specificationMapper.toResponse(version);
    }

    @Override
    public SpecificationVersionResponse archiveVersion(
            UUID specificationId,
            Integer versionNumber) {

        log.debug("Archive Version Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        validateStatus(
                version,
                VersionStatus.APPROVED,
                "archived"
        );

        version.setStatus(VersionStatus.ARCHIVED);
        if (version.getSpecification() != null) {
            version.getSpecification().setStatus(SpecificationStatus.ARCHIVED);
        }

        version = versionRepository.save(version);

        log.info("Version archived successfully | specificationId={} | version={} | status={}", specificationId, versionNumber, version.getStatus());
        return specificationMapper.toResponse(version);
    }

    @Override
    @Transactional(readOnly = true)
    public CompareVersionResponse compareVersions(
            UUID specificationId,
            Integer version1,
            Integer version2) {

        log.debug("Compare Versions Request | specificationId={} | v1={} | v2={}", specificationId, version1, version2);

        SpecificationVersion oldVersion =
                getVersionOrThrow(specificationId, version1);

        SpecificationVersion newVersion =
                getVersionOrThrow(specificationId, version2);

        List<FieldChangeResponse> changes = new ArrayList<>();

        compareField(changes, "description", oldVersion.getDescription(), newVersion.getDescription());
        compareField(changes, "userStories", oldVersion.getUserStories(), newVersion.getUserStories());
        compareField(changes, "acceptanceCriteria", oldVersion.getAcceptanceCriteria(), newVersion.getAcceptanceCriteria());
        compareField(changes, "functionalRequirements", oldVersion.getFunctionalRequirements(), newVersion.getFunctionalRequirements());
        compareField(changes, "nonFunctionalRequirements", oldVersion.getNonFunctionalRequirements(), newVersion.getNonFunctionalRequirements());

        log.info("Versions compared successfully | specificationId={} | v1={} | v2={} | diffCount={}", specificationId, version1, version2, changes.size());

        return CompareVersionResponse.builder()
                .version1(version1)
                .version2(version2)
                .changes(changes)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public String getVersionStatus(
            UUID specificationId,
            Integer versionNumber) {

        SpecificationVersion version =
                getVersionOrThrow(
                        specificationId,
                        versionNumber
                );

        return version.getStatus().name();
    }

    private SpecificationVersion getVersionOrThrow(
            UUID specificationId,
            Integer versionNumber) {

        return versionRepository
                .findBySpecificationIdAndVersionNumber(
                        specificationId,
                        versionNumber
                )
                .orElseThrow(() -> {

                    log.warn(
                            "Specification Version Not Found | specificationId={} | version={}",
                            specificationId,
                            versionNumber
                    );

                    return new SpecificationNotFoundException(
                            String.format(
                                    "Version %d not found for specification %s",
                                    versionNumber,
                                    specificationId
                            )
                    );
                });
    }

    private void validateStatus(
            SpecificationVersion version,
            VersionStatus expected,
            String action) {

        log.debug("Validating version workflow status | expected={} | actual={} | action={}", expected, version.getStatus(), action);

        if (version.getStatus() != expected) {

            log.warn("Invalid workflow transition requested | expected={} | actual={} | action={}", expected, version.getStatus(), action);

            throw new InvalidWorkflowStateException(
                    String.format(
                            "Only %s versions can be %s.",
                            expected,
                            action
                    )
            );
        }
    }

    private void compareField(
            List<FieldChangeResponse> changes,
            String field,
            String oldValue,
            String newValue) {

        if (!Objects.equals(oldValue, newValue)) {

            changes.add(
                    FieldChangeResponse.builder()
                            .field(field)
                            .oldValue(oldValue)
                            .newValue(newValue)
                            .build()
            );

        }
    }

    @Override
    public SpecificationVersionResponse updateDraftVersion(
            UUID specificationId,
            Integer versionNumber,
            UpdateVersionRequest request) {

        log.debug("Update Draft Version Request | specificationId={} | version={}", specificationId, versionNumber);

        SpecificationVersion version =
                getVersionOrThrow(specificationId, versionNumber);

        validateStatus(
                version,
                VersionStatus.DRAFT,
                "edited"
        );

        version.setDescription(request.getDescription());
        version.setUserStories(request.getUserStories());
        version.setFunctionalRequirements(
                request.getFunctionalRequirements()
        );
        version.setNonFunctionalRequirements(
                request.getNonFunctionalRequirements()
        );
        version.setAcceptanceCriteria(
                request.getAcceptanceCriteria()
        );

        version = versionRepository.save(version);

        log.info("Draft Version updated successfully | specificationId={} | version={}", specificationId, versionNumber);

        return specificationMapper.toResponse(version);
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
