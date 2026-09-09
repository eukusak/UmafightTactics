/** Physical letters work with Korean IME and Caps Lock, including user bindings. */
export function matchesKey(event: { key: string; code: string }, binding: string): boolean {
  if (!binding) return false;
  if (/^[a-z]$/i.test(binding)) return event.code === `Key${binding.toUpperCase()}` || event.key.toLowerCase() === binding.toLowerCase();
  return event.key === binding || event.code === binding;
}

export function bindingKey(event: { key: string; code: string }): string {
  return /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key;
}
