---
name: roadmap-updater
description: Update jadecli-roadmap-and-architecture repo with diagrams, ADRs, and roadmap status. Syncs with GitHub Projects board.
---

## Capabilities

### 1. Architecture Diagrams

- Create/edit Mermaid diagrams in diagrams/
- Supported types: C4Context, C4Container, sequenceDiagram, erDiagram, flowchart
- Validate Mermaid syntax before committing
- Commit with conventional format: docs(diagram): update <diagram-name>

### 2. Architecture Decision Records

- Create ADRs from MADR bare-minimal template in decisions/
- Auto-number: scan existing ADRs, take max + 1
- Commit with: docs(adr): add ADR-XXXX <title>
- Set initial status to "Proposed"

### 3. Roadmap Status

- Update roadmap/current.md with phase progress
- Move completed items to roadmap/completed.md with completion date
- Cross-reference GitHub Projects board items

### 4. GitHub Projects Sync

- Read board status: gh project item-list 4 --owner jadecli --format json
- Update item status via gh project item-edit
- Create new items via gh project item-create
- Link issues across repos via cross-references
