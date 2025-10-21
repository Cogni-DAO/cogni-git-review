# GitLab Merge Request Test Fixtures

## Overview
This directory contains GitLab merge request webhook payloads captured for testing GitLab integration functionality.

## Files

### test_repo_merge_request.opened.json
Real GitLab webhook payload captured from merge request #328 on the `cogni-dao/test/test-repo` repository:
- **Event Type**: Merge Request Hook (`x-gitlab-event`)
- **Action**: `opened` (new merge request created)
- **Project ID**: 75449860 (GitLab project identifier)
- **Source**: GitLab.com instance
- **Purpose**: End-to-end testing of GitLab MR webhook processing

## Test Usage
These fixtures are used by:
- GitLab webhook payload transformation testing
- GitLab context creation verification
- End-to-end GitLab integration tests
- Playwright E2E test specifications

## Webhook Details
The captured payload includes:
- Complete GitLab merge request object with all metadata
- Project information and repository details  
- User and author information
- GitLab-specific headers (`X-Gitlab-Event`, `X-Gitlab-Token`, etc.)
- Commit SHA and branch references

This enables testing the complete GitLab webhook → payload transformation → context creation → gate execution flow without requiring live GitLab webhooks.