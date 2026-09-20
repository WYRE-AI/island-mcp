# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Per-version release notes for tagged releases are published on the [GitHub Releases page](https://github.com/WYRE-AI/island-mcp/releases) - `semantic-release` generates them from commit history at release time.

## [Unreleased]

### Added

- Initial v1 release: 4 read-only tools covering Island Enterprise Browser's Admin Actions, Audit (Island's own endpoint name is `timeline`), Compromised Credential, and Device resource groups. Static API-key authentication (custom `Api-Key` header, generated in the Island Management Console). See README's Scope and Base URL sections for the full accounting of what's implemented, what's deliberately excluded, and which claims are independently confirmed versus vendor-documented-only.
