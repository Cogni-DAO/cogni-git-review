# Test Fixtures Directory

## What Goes Here
Reusable test data that eliminates duplication across test suites.

## Fixture Types
- **Repository specs**: YAML configurations for different test scenarios
- **Webhook payloads**: Real GitHub webhook events (check_run, check_suite, pull_request, installation)
- **Mock contexts**: GitHub API response simulations
- **Certificates**: Authentication test files

## Principles
- Use fixtures instead of inline test data
- Maintain consistent IDs and structure across all fixtures
- Base webhook fixtures on real GitHub payloads
- Keep sensitive data sanitized