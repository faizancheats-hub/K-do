export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
