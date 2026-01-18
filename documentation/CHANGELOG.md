# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-17

### Added

- **Two-Step Card Generation (Development Mode)** - Separated card generation from Yoto deployment
  - Step 1: Generate card data and review content
  - Step 2: Manual "Send to Yoto" button to deploy
  - Allows content review before sending to Yoto API
  - Prominent development mode notice in UI
  - Will be streamlined in future production releases
- **Meetings API Integration** - Switched from Sessions to Meetings endpoint
  - Better race naming (e.g., "Australian Grand Prix" vs. "Melbourne")
  - More comprehensive event information
  - Official race names and locations
  - Meeting metadata including country and circuit details
- **Circuit Type Information** - Enhanced race descriptions with track type
  - Identifies permanent racing circuits
  - Identifies temporary street circuits
  - Identifies temporary road courses
  - Included in TTS narration for better context
- **Country Flag Icons** - Dynamic country flag display on first chapter
  - Downloads flag from OpenF1 Meetings API
  - Uploads as 16x16 icon to Yoto
  - First chapter displays country flag instead of generic F1 icon
  - Visual indication of race location
- **Enhanced Race Location Display** - Improved UI and TTS content
  - Shows city and country separately (e.g., "Melbourne, Australia")
  - Circuit type mentioned in narration
  - Official event names included
  - Better geographical context

### Changed

- **Data Source** - Migrated from Sessions API to Meetings API for primary race data
  - More accurate and comprehensive race information
  - Better naming conventions
  - Richer metadata (circuit images, official names, etc.)
- **First Chapter Content** - Enhanced "Race Weekend Overview" narration
  - Now includes circuit type description
  - Better location information (city and country)
  - More conversational and informative
  - Official event name when available
- **UI Labels** - Updated terminology to match Meetings data
  - "Next Session" → "Next Race" (when displaying meeting info)
  - "Name" field shows meeting name (e.g., "Singapore Grand Prix")
  - Clearer distinction between location and country

### Fixed

- Race information now displays proper Grand Prix names instead of generic location names
- First chapter icon is now specific to the race country
- Improved data consistency across UI and TTS content

### Developer Notes

- New `/api/send-to-yoto` endpoint for second step of card generation
- `uploadCountryFlagIcon()` utility function in imageUtils.js
- `buildF1Chapters()` now accepts `countryFlagIconId` parameter
- `formatRaceData()` updated to handle Meetings API response structure
- Added `countryFlag` field to race data model

## [1.2.0] - 2026-01-16

### Added

- **Session-Based Chapters** - Multiple chapters now created for each F1 race weekend
  - Chapter 1: Race Weekend Overview with overall information
  - Chapters 2+: Individual chapters for each session (Practice 1-3, Qualifying, Sprint, Race)
  - Each chapter includes session-specific descriptions and context
- **Custom Icon Support** - Race car icon (🏎️) now displays on Yoto players
  - Automatically uploads `countdown-to-f1-icon.png` from `public/assets/card-images/`
  - Icon appears on all chapters and tracks for consistent branding
- **Enhanced Timezone Detection** - Improved IP-based timezone conversion
  - Detailed logging shows detected timezone for debugging
  - Better fallback handling for local/private IPs
  - Converts ALL session times to user's local timezone
- **OpenF1 Sessions API Integration** - Fetches all upcoming sessions for a race weekend
  - Automatically sorts sessions chronologically
  - Filters for upcoming events only
  - Includes Practice, Qualifying, Sprint, and Race sessions
- **Comprehensive Session Descriptions** - Custom text for each session type:
  - Practice: Setup work and data gathering details
  - Qualifying: Knockout format explanation (Q1, Q2, Q3)
  - Sprint: Race format and points information
  - Race: Full Grand Prix strategy notes
- **Enhanced UI Display** - "View Generated Content" now shows all chapters and tracks
  - Chapter count indicator in summary
  - Expandable view for each chapter's content
  - Visual organization with track-level detail

### Fixed

- **Date Conversion Bug** - Race dates now correctly reflect user's timezone
  - Previously showed wrong day when timezone crossed midnight
  - Now uses proper calendar day conversion
- **Mock Data Timezone** - Mock fallback data now properly converts to user timezone
  - Removed hardcoded date/time values
  - Consistent behavior between real API data and fallback

### Changed

- **Chapter Structure** - Moved from single chapter to multi-chapter format
  - Better organization of race weekend information
  - Each session gets dedicated attention and context
  - More engaging content for F1 fans
- **Timezone Logging** - Added detailed console output for timezone operations
  - Shows IP detection results
  - Displays original ISO timestamps
  - Confirms converted date/time values

### Documentation

- **SESSIONS_CHAPTERS_FEATURE.md** - Complete guide to session-based chapters
  - Technical implementation details
  - Timezone detection flow diagrams
  - Session type descriptions
  - Debugging information
- **README.md** - Updated with new features and timezone explanation
  - Multi-chapter system details
  - IP-based timezone detection process
  - Troubleshooting for timezone issues
- **QUICKSTART.md** - Added information about chapter structure
  - What users can expect when generating cards
  - Custom icon details

## [1.1.0] - 2026-01-11

### Added

- GitHub Actions workflow for automatic deployment to Fly.io on main branch push
- Console logging for OAuth URL detection (debugging)
- Comprehensive troubleshooting section in README for OAuth issues

### Fixed

- **OAuth redirect URL issues on deployed environments** - App now correctly detects the base URL at runtime using `x-forwarded-host` and `x-forwarded-proto` headers
- Final redirect after OAuth callback now uses the correct domain (no more localhost redirects in production)
- Works seamlessly on Fly.io and other platforms without configuration

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
- Support for Fly.io deployment

---

## Release Links

- [v1.1.0](https://github.com/dauble/yoto-app/releases/tag/v1.1.0) - OAuth fixes and auto-deployment
- [v1.0.0](https://github.com/dauble/yoto-app/releases/tag/v1.0.0) - Initial release
