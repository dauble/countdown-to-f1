# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-11

### Added

- GitHub Actions workflow for automatic deployment to Fly.io on main branch push
- Console logging for OAuth URL detection (debugging)
- Comprehensive troubleshooting section in README for OAuth issues

### Fixed

- **OAuth redirect URL issues on deployed environments** - App now correctly detects the base URL at runtime using `x-forwarded-host` and `x-forwarded-proto` headers
- Final redirect after OAuth callback now uses the correct domain (no more localhost redirects in production)
- Works seamlessly on Fly.io, Vercel, and other platforms without configuration

### Changed

- Removed requirement for `NEXT_PUBLIC_APP_URL` environment variable
- Simplified deployment process - only OAuth credentials needed
- Updated all documentation to reflect runtime URL detection

### Improved

- OAuth flow now works correctly in all deployment environments
- Better error handling and debugging for authentication flows
- Cleaner environment variable setup

## [1.0.0] - 2026-01-10

### Added

- Initial release
- Auto-update feature for existing cards
- Formula 1 race information fetching from OpenF1 API
- Timezone conversion based on user IP address
- Text-to-speech integration via Yoto Labs API
- OAuth authentication with Yoto
- Configstore for token and card ID storage
- Comprehensive documentation (README, CONTRIBUTING, QUICKSTART)
- MIT License
- GitHub issue templates

### Features

- Create and update Yoto MYO cards with F1 race information
- Single-click card generation
- Automatic updates to existing cards (no duplicates)
- Responsive web interface
- Support for Fly.io and Vercel deployment

---

## Release Links

- [v1.1.0](https://github.com/yourusername/yoto-f1-card/releases/tag/v1.1.0) - OAuth fixes and auto-deployment
- [v1.0.0](https://github.com/yourusername/yoto-f1-card/releases/tag/v1.0.0) - Initial release
