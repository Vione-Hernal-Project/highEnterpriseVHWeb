import "server-only";

import { resolve, sep } from "node:path";

import { isSafeLocalPublicAssetPath } from "@/lib/security/asset-urls";

export function resolveSafePublicAssetPath(value: string) {
  if (!isSafeLocalPublicAssetPath(value)) {
    return null;
  }

  const pathname = new URL(value, "https://local.invalid").pathname;
  const publicDir = resolve(process.cwd(), "public");
  const absolutePath = resolve(publicDir, `.${pathname}`);

  if (!absolutePath.startsWith(`${publicDir}${sep}`)) {
    return null;
  }

  return absolutePath;
}
