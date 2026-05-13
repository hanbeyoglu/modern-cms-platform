const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; firstName: string | null; lastName: string | null; isSuperAdmin: boolean };
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Giriş başarısız (${res.status})`);
  }
  return (await res.json()) as LoginResponse;
}

export async function apiMe(accessToken: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `İstek başarısız (${res.status})`);
  }
  return res.json();
}
