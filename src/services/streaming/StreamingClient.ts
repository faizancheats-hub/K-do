export async function* streamSse<T>(
  response: Response,
  extract: (payload: T) => string | undefined
): AsyncIterable<string> {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }

      const parsed = JSON.parse(payload) as T;
      const token = extract(parsed);
      if (token) {
        yield token;
      }
    }
  }
}

export async function* streamJsonLines<T>(
  response: Response,
  extract: (payload: T) => string | undefined
): AsyncIterable<string> {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines.map((item) => item.trim()).filter(Boolean)) {
      const parsed = JSON.parse(line) as T;
      const token = extract(parsed);
      if (token) {
        yield token;
      }
    }
  }
}
