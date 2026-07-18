// Ad-hoc code-signing for the macOS build (FREE — no Apple Developer account).
//
// Why: an unsigned Apple-Silicon app that was downloaded (quarantined) triggers
// the harsh "app is damaged, move to Trash" block, which offers NO "Open Anyway"
// button — so the only way in is a Terminal command. An AD-HOC signature softens
// this to the ordinary "unidentified developer" block, which DOES show an
// "Open Anyway" button in System Settings, so first launch needs no Terminal.
//
// This does NOT change how the app runs and requires no certificate. If codesign
// is unavailable or fails for any reason, we log and continue so the build still
// succeeds exactly as before (fail-safe — it can never make the build worse).
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;            // macOS only
  const path = require('path');
  const { execFileSync } = require('child_process');
  const appName = context.packager.appInfo.productFilename + '.app';
  const appPath = path.join(context.appOutDir, appName);
  try {
    // "-" = ad-hoc identity (no certificate). --force replaces any existing
    // signature; --deep signs the nested Electron frameworks/helpers too.
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    console.log('[after-pack] ad-hoc signed: ' + appPath);
  } catch (e) {
    console.warn('[after-pack] ad-hoc sign skipped (build continues unsigned): ' + (e && e.message));
  }
};
