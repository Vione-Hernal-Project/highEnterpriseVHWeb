import "server-only";

export type UploadKind = "ico" | "jpeg" | "mp4" | "png" | "webp";

export type VerifiedUpload = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  kind: UploadKind;
};

const UPLOAD_TYPES: Record<UploadKind, { contentType: string; extension: string }> = {
  ico: { contentType: "image/x-icon", extension: ".ico" },
  jpeg: { contentType: "image/jpeg", extension: ".jpg" },
  mp4: { contentType: "video/mp4", extension: ".mp4" },
  png: { contentType: "image/png", extension: ".png" },
  webp: { contentType: "image/webp", extension: ".webp" },
};

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function detectUploadKind(bytes: Uint8Array): UploadKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return "ico";
  }

  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "mp4";
  }

  return null;
}

export function sanitizeStoragePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export async function verifyUploadFile(file: Blob, allowedKinds: readonly UploadKind[]): Promise<VerifiedUpload | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectUploadKind(bytes);

  if (!kind || !allowedKinds.includes(kind)) {
    return null;
  }

  return {
    bytes,
    kind,
    ...UPLOAD_TYPES[kind],
  };
}
