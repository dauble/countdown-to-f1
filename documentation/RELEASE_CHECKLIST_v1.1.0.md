# 🚀 Release v1.1.0 Checklist

## Pre-Release Tasks

- [x] Update version in package.json to 1.1.0
- [x] Create/update CHANGELOG.md with v1.1.0 changes
- [x] Update README.md with latest features
- [x] Update .env.example
- [x] Update QUICKSTART.md
- [x] Update RELEASE_NOTES.md
- [ ] Test OAuth flow locally
- [ ] Test OAuth flow on Fly.io deployment
- [ ] Verify auto-update functionality
- [ ] Test GitHub Actions deployment workflow

## Release Commands

```bash
# 1. Commit all changes
git add .
git commit -m "chore: Release v1.1.0 - OAuth fixes and auto-deployment"

# 2. Create and push tag
git tag -a v1.1.0 -m "Release v1.1.0 - OAuth fixes and auto-deployment"
git push origin v1.1.0

# 3. Push to main
git push origin main
```

## GitHub Release Creation

1. Go to: https://github.com/YOUR_USERNAME/yoto-f1-card/releases/new
2. Choose tag: `v1.1.0`
3. Release title: `🏎️ v1.1.0 - OAuth Fixes & Auto-Deployment`
4. Description:

```markdown
## 🔧 Major Fixes

- **Fixed OAuth redirect URLs** - App now works correctly on Fly.io and other deployment platforms
- **Runtime URL detection** - Automatically detects correct URL using request headers
- **No more localhost redirects** - Production deployments work seamlessly

## 🚀 New Features

- **GitHub Actions CI/CD** - Automatic deployment to Fly.io on push to main
- **Simplified configuration** - Removed need for `NEXT_PUBLIC_APP_URL` environment variable
- **Better debugging** - Added console logs for OAuth troubleshooting

## 📝 Documentation

- Updated deployment instructions
- Added OAuth troubleshooting guide
- Simplified environment setup
- Added CHANGELOG.md

## 🔄 Upgrading from v1.0.0

If you're upgrading from v1.0.0:

1. Pull the latest code
2. Remove `NEXT_PUBLIC_APP_URL` from your `.env` and Fly secrets
3. Add both redirect URIs to your Yoto app:
   - `http://localhost:3000/api/auth/callback`
   - `https://your-app.fly.dev/api/auth/callback`
4. Redeploy: `fly deploy`

## 📦 Installation

See the [README](https://github.com/YOUR_USERNAME/yoto-f1-card#readme) for full installation instructions.

## 🐛 Bug Reports

Found a bug? [Open an issue](https://github.com/YOUR_USERNAME/yoto-f1-card/issues/new?template=bug_report.md)

---

**Full Changelog**: https://github.com/YOUR_USERNAME/yoto-f1-card/compare/v1.0.0...v1.1.0
```

5. Click "Publish release"

## Post-Release Tasks

- [ ] Announce in Yoto Discord #developers channel
- [ ] Share on social media (optional)
- [ ] Update live demo if applicable
- [ ] Monitor issues for any problems

## Verification

After release:

- [ ] GitHub release is live
- [ ] Tag is pushed
- [ ] GitHub Actions deployment succeeded
- [ ] Live site is working correctly
- [ ] OAuth flow works on production
- [ ] Card generation works

## Rollback Plan

If issues are found:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or redeploy previous version
fly deploy --image registry.fly.io/your-app:previous-version
```

---

## Notes

- This release focuses on deployment and OAuth fixes
- No breaking changes for existing users
- Simplifies the deployment process significantly
- Makes the app truly platform-agnostic
