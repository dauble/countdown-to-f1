# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Enhanced Race Details** - Cards now include additional contextual information:
  - Official event name (e.g., "Formula 1 MSC Cruises Japanese Grand Prix 2024")
  - Country name for each race
  - Circuit type (Permanent, Temporary - Street, or Temporary - Road)
  - Current weather conditions:
    - Air and track temperatures
    - Humidity percentage
    - Wind speed
    - Rainfall status (wet/dry track)
- `getMeetingDetails()` function to fetch circuit and location information from OpenF1 API
- `getSessionWeather()` function to fetch live weather data from OpenF1 API
- `getUpcomingSessions()` function re-added to fetch all sessions for a race weekend
- Comprehensive documentation in `ENHANCED_RACE_DETAILS_FEATURE.md`

### Changed

- `buildF1Chapters()` now accepts optional `meetingDetails` and `weather` parameters
- Card generation process includes two additional API calls (gracefully degraded if they fail)
- Chapter text is more descriptive and educational with location and weather context

### Improved

- More engaging and informative TTS content for children
- Better understanding of race location and conditions
- Educational value with country and circuit type information

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
