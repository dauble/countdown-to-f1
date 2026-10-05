# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.2] - 2026-10-05

### Changed

- **Full championship standings are stored in the Cloudflare Worker's KV payload.** The worker now
  fetches every driver and team standing from the latest completed race (OpenF1
  `championship_drivers` and `championship_teams`) and stores them under `standings` in the KV payload.
- **The top 5 standings are part of the `dataHash`.** Only the top 5 appear on the playlist, so only
  those affect the hash. A change to position, driver/team, or points in the top 5 triggers a TTS
  regeneration in the app's refresh webhook. Changes further down the table are stored in KV but do not
  trigger a regeneration. Previously the hash ignored standings, so standings chapters could go stale
  until the race or session data changed.
- Standings lookups fail loudly in the worker: a failed or empty OpenF1 response makes the scheduled
  run keep the last good KV payload rather than hashing placeholder data.

### Notes

- The first run after deploying this release changes the hash, so the app regenerates TTS audio once.
  That uses ElevenLabs credits, subject to the weekly limit and quota handling from 1.5.0.
- Requires redeploying the worker (`npx wrangler deploy` in `cloudflare-worker/`).
## [1.5.1] - 2026-10-05

### Fixed

- **The Cloudflare Worker now refreshes its KV data on every scheduled run.** The scheduled handler
  only wrote to KV when the `dataHash` changed, so fields excluded from the hash (notably weather)
  stayed stale in KV and `/playlist` kept serving them. The worker now always writes the fresh
  payload to KV. TTS regeneration is still gated by `dataHash` and the weekly limit in the app's
  refresh webhook, so ElevenLabs usage is unchanged. Requires redeploying the worker
  (`npx wrangler deploy` in `cloudflare-worker/`).

## [1.5.0] - 2026-10-05

### Added

- **Weekly limit on TTS regeneration.** The automated refresh regenerates ElevenLabs audio at most
  once every 7 days, even when the F1 data changes more often. Runs inside that window skip the
  ElevenLabs calls entirely. The timestamp of the last successful regeneration is stored alongside
  the data hash in the app's config file (`/data` on Fly). Manual `workflow_dispatch` runs are subject
  to the same limit. Playlist content can lag by up to a week after F1 data changes.

### Changed

- **ElevenLabs quota errors are a soft skip.** When ElevenLabs returns `quota_exceeded` (out of
  credits), the webhook responds with HTTP 200 and `skipped: true` plus a reason, instead of a 500.
  The data hash is not stored on that path, so the next scheduled run retries.
- **Skipped refreshes show as warnings.** The `Refresh F1 Yoto Playlist` workflow emits a
  `::warning::` annotation with the skip reason, and the job stays green.

## [1.4.2] - 2026-09-21

### Fixed

- **Restored the automated playlist refresh after the Fly.io app rename.** The Fly app was renamed
  from `yoto-app` to `countdown-to-f1` in a relaunch (2026-09-04), which silently broke the whole
  automation chain in several independent ways:
  - `fly.toml`'s `internal_port` was reset to `8080` by the relaunch, but the app (Dockerfile
    `EXPOSE 3000`, `next start`) still listens on `3000` — Fly's proxy couldn't find a listener and
    returned 502s for every request. Reverted `internal_port` to `3000`.
  - The `APP_URL` GitHub Actions repository secret still pointed at the old, now-unresolvable
    `yoto-app.fly.dev` hostname, so the scheduled workflow failed immediately with curl exit code 6
    ("couldn't resolve host") before ever reaching the app. Updated it to `countdown-to-f1.fly.dev`.
  - The new Fly app has its own fresh volume, so `YOTO_CLIENT_ID` and `ELEVENLABS_API_KEY` runtime
    secrets (and the stored Yoto OAuth token) didn't carry over from the old app. Re-set both secrets
    and re-authenticated via `/api/auth/login`.
- **Fixed missing OAuth scopes for content/icon uploads.** `/api/auth/login` only ever requested the
  `offline_access` scope, so the stored access token never had permission to call the Yoto content
  and icon upload endpoints — this is what previously looked like an account-tier restriction (see
  the old "Cover image not appearing" troubleshooting entry) but was actually just a missing scope
  request. Added `user:content:manage` and `user:icons:manage` to the login flow; cover images and
  team/country icons now upload successfully.
  - Also attempted adding `family:devices:view`/`family:devices:control` for automatic device
    deployment, but Yoto rejects the whole login with `access_denied` for OAuth clients that haven't
    been pre-approved for device scopes — reverted those two pending that approval. Device deployment
    remains a best-effort, non-fatal no-op until then.
- Documented all of the above in the README, `.env.example`, and the GitHub Actions workflow's
  setup comments, so a future Fly app rename doesn't require re-discovering this from scratch.

## [1.4.1] - 2026-08-30

### Fixed

- **Project is supported again.** The 1.4.0 archival notice claimed OpenF1
  now requires a paid subscription for all access. That was inaccurate:
  OpenF1 offers a free **Community** tier (see the
  [Access & Support section](https://openf1.org/#features)) with a documented
  limit of up to 3 requests/second and 30 requests/minute — this project has
  never needed more than that. The archival notice has been removed and
  development continues.
- **Centralized OpenF1 rate limiting** - Replaced the scattered fixed 500ms
  delays in `f1Service.js` and the Cloudflare Worker with a shared
  rate-limited request queue (`openf1Fetch`) that:
  - Paces every OpenF1 call across the whole app to ~2.5 req/sec and 28
    req/min, staying safely under the Community-tier ceiling even when
    multiple requests run concurrently
  - Retries once on HTTP 429, honoring the `Retry-After` header
  - Removes duplicate lookups of the latest completed race session between
    driver and team standings, cutting the number of calls needed per card
    generation

## [1.4.0] - 2026-08-23

### Added

- **Cloudflare Worker Auto-Refresh** - Optional serverless integration for automatic content updates
  - Daily scheduled data refresh from OpenF1 API
  - Global edge caching with Cloudflare KV storage
  - Manual refresh endpoint for immediate updates
  - Health check endpoint for monitoring
  - Runs on Cloudflare's free tier for typical usage
  - Optional integration - enable via environment variables
  - Comprehensive deployment and configuration documentation
  - Reduces API load on OpenF1 with intelligent caching
  - Low-latency access from anywhere in the world

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
