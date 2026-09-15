package com.neuroforge.backend.pipeline.dto;

import lombok.Data;

@Data
public class RunPipelineRequest {

    private Long pipelineId;
    private Long orgId;
}
