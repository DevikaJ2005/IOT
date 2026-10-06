export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: 'Request failed.' }))
    throw new Error(data.detail || 'Request failed.')
  }

  return response.json() as Promise<T>
}
