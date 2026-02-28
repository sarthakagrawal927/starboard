const GITHUB_AVATAR_HOST = "avatars.githubusercontent.com";

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isGitHubAvatarUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (parsed) return parsed.hostname === GITHUB_AVATAR_HOST;
  return url.includes(GITHUB_AVATAR_HOST);
}

function clampAvatarSize(size: number): number {
  return Math.max(1, Math.round(size));
}

function getSizedAvatarUrl(url: string, size: number): string {
  if (!isGitHubAvatarUrl(url)) return url;

  const parsed = parseUrl(url);
  if (!parsed) return url;

  parsed.searchParams.set("s", String(clampAvatarSize(size)));
  return parsed.toString();
}

export function getAvatarImageAttrs(url: string, size: number): {
  src: string;
  srcSet?: string;
  sizes: string;
} {
  const targetSize = clampAvatarSize(size);
  const src = getSizedAvatarUrl(url, targetSize);

  if (!isGitHubAvatarUrl(url)) {
    return {
      src,
      sizes: `${targetSize}px`,
    };
  }

  const src2x = getSizedAvatarUrl(url, targetSize * 2);

  return {
    src,
    srcSet: `${src} 1x, ${src2x} 2x`,
    sizes: `${targetSize}px`,
  };
}
