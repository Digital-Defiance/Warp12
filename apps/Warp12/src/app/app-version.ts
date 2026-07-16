/** Shipped app semver (0.MINOR.BUILD) — injected at build from package.json. */
export const APP_VERSION: string =
  import.meta.env.VITE_APP_VERSION ?? 'dev';

/** Mobile integer build (patch segment); matches iOS bundleVersion / Android versionCode. */
export function appBuildNumber(version: string = APP_VERSION): number | null {
  const match = /^0\.\d+\.(\d+)$/.exec(version);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function formatAppVersionLabel(version: string = APP_VERSION): string {
  const build = appBuildNumber(version);
  if (build === null) {
    return `v${version}`;
  }
  return `v${version} (build ${build})`;
}
