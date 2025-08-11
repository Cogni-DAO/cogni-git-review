SHELL := /bin/bash
.DEFAULT_GOAL := help

OWNER ?= Cogni-DAO
REPO ?= cogni-git-review
BRANCH ?= main
CHECK_NAME ?= Cogni Git PR Review
API_VERSION ?= 2022-11-28

.PHONY: setup-branch-protection verify-branch-protection help

help:
	@echo "Available commands:"
	@echo "  make setup-branch-protection [OWNER=.. REPO=.. BRANCH=.. CHECK_NAME=..]"
	@echo "  make verify-branch-protection - Verify required check is set"
	@echo "  make help                     - Show this help message"

setup-branch-protection:
	@gh auth status >/dev/null 2>&1 || { echo "❌ gh not authenticated. Run 'gh auth login'"; exit 1; }
	@echo "Adding status check requirement to $(OWNER)/$(REPO):$(BRANCH) for '$(CHECK_NAME)' (preserves other rules)..."
	@printf '{"strict":true,"contexts":["%s"]}' '$(CHECK_NAME)' | \
		gh api -X PATCH \
		-H "Accept: application/vnd.github+json" \
		-H "X-GitHub-Api-Version: $(API_VERSION)" \
		repos/$(OWNER)/$(REPO)/branches/$(BRANCH)/protection/required_status_checks \
		--input -
	@$(MAKE) --no-print-directory verify-branch-protection

verify-branch-protection:
	@echo "Verifying required status checks for $(OWNER)/$(REPO):$(BRANCH)..."
	@PROTECTION_DATA=$$(gh api repos/$(OWNER)/$(REPO)/branches/$(BRANCH)/protection/required_status_checks 2>/dev/null) && \
		echo "$$PROTECTION_DATA" | jq -r '.contexts[]' | grep -qx '$(CHECK_NAME)' && \
		STRICT_MODE=$$(echo "$$PROTECTION_DATA" | jq -r '.strict') && \
		echo "✅ Branch protection includes: $(CHECK_NAME) (strict: $$STRICT_MODE)" || \
		{ echo "❌ Required check '$(CHECK_NAME)' not found or branch protection not configured"; exit 1; }