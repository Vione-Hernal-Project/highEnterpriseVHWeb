type ErrorPayload = {
  error?: string;
};

function formatByteLimit(maxBytes: number) {
  if (maxBytes >= 1024 * 1024) {
    return `${Math.round((maxBytes / (1024 * 1024)) * 10) / 10} MB`;
  }

  if (maxBytes >= 1024) {
    return `${Math.round(maxBytes / 1024)} KB`;
  }

  return `${maxBytes} bytes`;
}

export async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getResponseErrorMessage(payload: ErrorPayload | null, fallback: string) {
  return typeof payload?.error === "string" && payload.error.trim() ? payload.error : fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function getJsonBodySizeError(request: Request, maxBytes: number) {
  const contentLengthHeader = request.headers.get("content-length");

  if (!contentLengthHeader) {
    return null;
  }

  const contentLength = Number(contentLengthHeader);

  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return "Request body is invalid.";
  }

  if (contentLength > maxBytes) {
    return `Request body is too large. Limit is ${formatByteLimit(maxBytes)}.`;
  }

  return null;
}
