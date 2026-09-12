// Public art keeps its filename across patches, unlike Vite's hashed JS/CSS.
declare const __ASSET_VERSION__: string;
export const ASSET_VERSION = typeof __ASSET_VERSION__ === 'string' ? __ASSET_VERSION__ : 'test';
export function versionedAssetUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(ASSET_VERSION)}`;
}
