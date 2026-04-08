type ErrorPayload = {
  error?: string;
};

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
