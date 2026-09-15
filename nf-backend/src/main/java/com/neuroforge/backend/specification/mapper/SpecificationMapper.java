package com.neuroforge.backend.specification.mapper;

import com.neuroforge.backend.specification.dto.response.SpecificationResponse;
import com.neuroforge.backend.specification.dto.response.SpecificationVersionResponse;
import com.neuroforge.backend.specification.entity.Specification;
import com.neuroforge.backend.specification.entity.SpecificationVersion;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class SpecificationMapper {

    public SpecificationResponse toResponse(Specification specification) {
        if (specification == null) {
            return null;
        }

        return SpecificationResponse.builder()
                .id(specification.getId())
                .specificationKey(specification.getSpecificationKey())
                .title(specification.getTitle())
                .currentVersion(specification.getCurrentVersion())
                .status(specification.getStatus())
                .organizationId(specification.getOrganizationId())
                .projectId(specification.getProjectId())
                .createdAt(specification.getCreatedAt())
                .updatedAt(specification.getUpdatedAt())
                .build();
    }

    public List<SpecificationResponse> toResponse(List<Specification> specifications) {
        if (specifications == null) {
            return null;
        }

        List<SpecificationResponse> list = new ArrayList<>(specifications.size());
        for (Specification specification : specifications) {
            list.add(toResponse(specification));
        }

        return list;
    }

    public SpecificationVersionResponse toResponse(SpecificationVersion version) {
        if (version == null) {
            return null;
        }

        return SpecificationVersionResponse.builder()
                .id(version.getId())
                .versionNumber(version.getVersionNumber())
                .description(version.getDescription())
                .userStories(version.getUserStories())
                .acceptanceCriteria(version.getAcceptanceCriteria())
                .functionalRequirements(version.getFunctionalRequirements())
                .nonFunctionalRequirements(version.getNonFunctionalRequirements())
                .status(version.getStatus())
                .generatedBy(version.getGeneratedBy())
                .generatedAt(version.getGeneratedAt())
                .createdAt(version.getCreatedAt())
                .updatedAt(version.getUpdatedAt())
                .build();
    }
}
