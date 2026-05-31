import "server-only";

import sharp from "sharp";

export type VerifiedMediaUpload = {
  bytes: Buffer | Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  extension: ".jpg" | ".png" | ".webp" | ".mp4";
};

export class MediaUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadValidationError";
  }
}

const IMAGE_TYPE_EXTENSION = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

const MAX_IMAGE_INPUT_PIXELS = 28_000_000;

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectRasterImageType(bytes: Uint8Array): keyof typeof IMAGE_TYPE_EXTENSION | null {
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function detectMp4(bytes: Uint8Array) {
  return bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

function normalizeDeclaredType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || "";
}

function invalidUpload(message: string): never {
  throw new MediaUploadValidationError(message);
}

export function isMediaUploadValidationError(error: unknown): error is MediaUploadValidationError {
  return error instanceof MediaUploadValidationError;
}

export async function verifyRasterImageUpload(params: {
  bytes: Uint8Array;
  declaredType?: string | null;
  label?: string;
}): Promise<VerifiedMediaUpload> {
  const detectedType = detectRasterImageType(params.bytes);
  const declaredType = normalizeDeclaredType(params.declaredType);
  const label = params.label || "image";

  if (!detectedType) {
    invalidUpload(`The ${label} must be a valid PNG, JPG, or WEBP file.`);
  }

  if (declaredType && declaredType !== detectedType) {
    invalidUpload(`The ${label} file type does not match its contents.`);
  }

  try {
    const input = sharp(params.bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    }).rotate();

    if (detectedType === "image/png") {
      return {
        bytes: await input.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
        contentType: detectedType,
        extension: IMAGE_TYPE_EXTENSION[detectedType],
      };
    }

    if (detectedType === "image/webp") {
      return {
        bytes: await input.webp({ quality: 88 }).toBuffer(),
        contentType: detectedType,
        extension: IMAGE_TYPE_EXTENSION[detectedType],
      };
    }

    return {
      bytes: await input.jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
      contentType: detectedType,
      extension: IMAGE_TYPE_EXTENSION[detectedType],
    };
  } catch {
    invalidUpload(`The ${label} could not be decoded as a safe image file.`);
  }
}

export function verifyMp4Upload(params: {
  bytes: Uint8Array;
  declaredType?: string | null;
  label?: string;
}): VerifiedMediaUpload {
  const declaredType = normalizeDeclaredType(params.declaredType);
  const label = params.label || "video";

  if (declaredType && declaredType !== "video/mp4") {
    invalidUpload(`The ${label} must be an MP4 file.`);
  }

  if (!detectMp4(params.bytes)) {
    invalidUpload(`The ${label} file type does not match its contents.`);
  }

  return {
    bytes: params.bytes,
    contentType: "video/mp4",
    extension: ".mp4",
  };
}
