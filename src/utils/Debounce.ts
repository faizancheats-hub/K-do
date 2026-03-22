export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  let timer: NodeJS.Timeout | undefined;
  return (...args: TArgs) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
