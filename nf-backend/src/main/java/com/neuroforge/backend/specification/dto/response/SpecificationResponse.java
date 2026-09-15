package com.neuroforge.backend.specification.dto.response;

import com.neuroforge.backend.specification.enums.SpecificationStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpecificationResponse {

    private UUID id;

    private String specificationKey;

    private String title;

    private Integer currentVersion;

    private SpecificationStatus status;

    private Long organizationId;

    private UUID projectId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

}
