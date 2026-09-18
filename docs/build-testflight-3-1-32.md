# Building and uploading 3.1 (32)

Part 10 of the Guideline 1.2 brief pointed at `claude/build-testflight-and-submit.md` §6.
**That file does not exist in this repository** — there is no `claude/` directory at
all. These steps were reconstructed from the project's actual build settings, which
are cited inline so you can check each one. Anything I could not verify from the repo
is marked **[ASSUMED]**; if the original doc says otherwise, it wins.

Everything below needs a Mac with Xcode. None of it was run here.

---

## What the repo actually says

Verified in `ios/App/App.xcodeproj/project.pbxproj` and `package.json`:

| Setting | Value | Where |
|---|---|---|
| `MARKETING_VERSION` | `3.1` | pbxproj L337, L365 (both configs) |
| `CURRENT_PROJECT_VERSION` | `32` | pbxproj L330, L358 (both configs) |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.mysetlists.app` | pbxproj L339, L366 |
| `DEVELOPMENT_TEAM` | `66N4YR3VP9` | pbxproj L237, L300 |
| `CODE_SIGN_STYLE` | `Automatic` | pbxproj L329, L357 |
| Release entitlements | `App/AppRelease.entitlements` | pbxproj L356 |
| Debug entitlements | `App/App.entitlements` | pbxproj L328 |
| `TARGETED_DEVICE_FAMILY` | `1` (iPhone only) | pbxproj L347, L374 |
| Build script | `next build && npx cap sync ios` | `package.json` → `build:ios` |

`AppRelease.entitlements` has `aps-environment` = **production**; `App.entitlements`
has **development**. That split is why the Release config points at a different file —
don't "tidy" them into one.

`PrivacyInfo.xcprivacy` is a member of the **Resources** build phase (pbxproj L157),
so it is copied into the bundle by the build rather than needing a manual step. That
answers the brief's "confirm the privacy manifest is in the bundle" statically; the
`.app` check below is belt and braces.

---

## 1. Build the web bundle

```
npm ci
npm run build:ios
```

`build:ios` is `next build && npx cap sync ios`. The `prebuild` hook stamps
`public/service-worker.js` with the `package.json` version, so after this the file
should read `mysetlists-v5.36.2`:

```
grep CACHE_NAME public/service-worker.js
```

If it does not, the version bump did not take and the archive will ship a stale
service worker.

## 2. Open the workspace

```
npm run open:ios
```

That runs `npx cap open ios`. **The workspace, never the project** — `App.xcworkspace`,
not `App.xcodeproj`. Opening the bare project skips the CocoaPods/SPM dependencies and
the build fails in a way that looks like missing Capacitor headers.

## 3. Check signing and entitlements

With the **App** target selected:

- **Signing & Capabilities → Release**
  - Team is `66N4YR3VP9`
  - Automatically manage signing is ticked (`CODE_SIGN_STYLE = Automatic`)
  - Bundle identifier is `com.mysetlists.app`
  - Push Notifications capability present, and the entitlements file for Release is
    `App/AppRelease.entitlements`
  - Sign in with Apple capability present (`com.apple.developer.applesignin`)
  - Associated Domains shows `applinks:mysetlists.net`
- **General → Identity**
  - Version `3.1`, Build `32`

If Xcode offers to "fix" the version or build number, decline. They are set in the
project file deliberately and App Store Connect expects exactly 3.1 (32).

## 4. Archive

- Destination: **Any iOS Device (arm64)**. A simulator destination produces an archive
  that cannot be uploaded.
- **Product → Archive**

## 5. Confirm the privacy manifest made it into the bundle

Before uploading, in the Organizer: right-click the archive → **Show in Finder** →
right-click the `.xcarchive` → **Show Package Contents** →
`Products/Applications/App.app`, then check `PrivacyInfo.xcprivacy` is present at the
top level. It should be, per the Resources build phase above; if it is missing the
build phase was changed.

Same place, worth a glance while you are in there:
- `Info.plist` carries the three `NS*UsageDescription` strings and **no**
  `NSUserTrackingUsageDescription`
- `embedded.mobileprovision` is the production profile

## 6. Upload

- **Distribute App → App Store Connect → Upload**
- **Untick "Manage Version and Build Number"** — this is the one the brief calls out.
  Left ticked, Xcode rewrites the build number to something of its own choosing and
  the upload arrives as a build you did not intend.
- Automatic signing for distribution is fine given `CODE_SIGN_STYLE = Automatic`.

## 7. Confirm what arrived

In App Store Connect → TestFlight, the new build should appear as **3.1 (32)**. If it
shows any other build number, step 6's checkbox was left ticked.

Wait for processing to finish before installing on the device for the Part 9 pass.

---

## Before you submit

Do not reply to App Review until all three are done:

1. **The device pass** — the eleven `[VERIFY ON DEVICE]` rows in
   `docs/app-review-1-2-reply.md`. Roughly a third of this build has been read but
   never run.
2. **Seed the demo accounts with `--reset`:**
   ```
   node scripts/seed-review-account.js --yes --reset
   node scripts/verify-review-account.js
   ```
   The `--reset` is not optional. The reviewer is asked to block `reviewfriend@`, that
   block is permanent, and a leftover one from the last round makes the friend's
   content invisible to `appreview@` — so the reviewer would find nothing to flag and
   would be right to say the feature does not work.
3. **The screen recording** on a physical device from a fresh install — shot list in
   `docs/app-review-1-2-reply.md` §1.

## Also worth doing in App Store Connect

Not code, so not in the PR, but flagged in Part 8:

- **Age rating questionnaire**: re-check the user-generated-content answers. The app
  now has flagging, blocking and moderation controls.
- **App Privacy**: the privacy manifest declares `PhotosorVideos` and
  `OtherUserContent`, both linked to identity, purpose App Functionality. Confirm the
  App Privacy answers match.
- **Store listing copy**: not audited this round. 5.36.1 removed Spotify and Apple
  Music from the app, so a description still promising playlists now contradicts the
  binary. **[ASSUMED]** that nobody has updated it since.
