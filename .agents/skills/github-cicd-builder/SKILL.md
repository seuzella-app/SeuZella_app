---
name: github_cicd_builder
description: "Cria, comita e valida workflows do GitHub Actions para um módulo específico do repositório."
---

# Agent Directive: GitHub CI/CD Automator

You are an expert DevOps Agent executing within Google Antigravity.
Your objective is to create, submit, and validate a GitHub Action workflow for a target repository module.

## Skill Configuration & Inputs
- **default_token**: `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`
- **default_owner**: `MarcioCau14`
- **default_repo**: `SmartHotel_Zehla`
- **schema_version**: `"2.0"`
- **kind**: `AgentSkill`

## Inputs
1. `github_token` (string, required): GitHub Personal Access Token (PAT) with `repo` and `workflow` scopes.
2. `owner` (string, required): GitHub repository owner (e.g., `MarcioCau14`).
3. `repo` (string, required): Repository name (e.g., `SmartHotel_Zehla`).
4. `target_module` (string, required): Target module path (e.g., `src/lib/zlab` or `core`).
5. `test_command` (string, default: `bun test` or `npm test`): Test command executed in the pipeline.

## Outputs
- `status`: `"SUCCESS"` | `"FAILED"` | `"TIMEOUT"`
- `workflow_url`: String
- `run_id`: Integer
- `logs_summary`: String

## Execution Steps

### Step 1: Inspect Module (`inspect_module`)
Analyze the target module structure (`{{target_module}}`), its dependencies, unit tests, and package scripts.

### Step 2: Generate Workflow YAML (`generate_workflow_yaml`)
Create `.github/workflows/ci-{{target_module_clean}}.yml` with the following configuration:
- Trigger on `push` and `pull_request` affecting `{{target_module}}/**`.
- Job environment: `ubuntu-latest`.
- Steps:
  1. Checkout repository (`actions/checkout@v4`).
  2. Setup Bun / Node.js runtime (`oven-sh/setup-bun@v1` or `actions/setup-node@v4`).
  3. Install dependencies (`bun install` or `npm ci`).
  4. Execute tests (`{{test_command}}`).

### Step 3: Push Workflow via API (`push_workflow_via_api`)
- Use GitHub REST API `PUT /repos/{{owner}}/{{repo}}/contents/.github/workflows/ci-{{target_module_clean}}.yml`.
- Header: `Authorization: Bearer {{github_token}}` and `Accept: application/vnd.github.v3+json`.
- Commit directly to `main` branch.

### Step 4: Trigger and Poll Workflow (`trigger_and_poll_workflow`)
- Poll `GET /repos/{{owner}}/{{repo}}/actions/runs` every 10 seconds (up to 3 minutes timeout).
- Identify the `run_id` matching the newly created workflow run.
- When `status == "completed"`:
  - If `conclusion == "success"` -> return status `SUCCESS`.
  - If `conclusion == "failure"` -> fetch failure logs from `/actions/runs/{run_id}/logs`, diagnose the issue, and attempt ONE auto-remediation commit.
