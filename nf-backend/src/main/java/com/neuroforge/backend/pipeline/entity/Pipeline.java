package com.neuroforge.backend.pipeline.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.neuroforge.backend.organization.entity.Organization;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "pipelines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pipeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String repositoryName;

    @Column(nullable = false)
    private String defaultBranch;

    @Column(nullable = false)
    private Boolean active;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = true)
    @JsonIgnore
    private Organization organization;
}
