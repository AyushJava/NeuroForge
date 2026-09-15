package com.neuroforge.backend.pipeline.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateReleaseRequest {

    private String version;

    private List<Long> taskIds;

    private Long organizationId;
}
