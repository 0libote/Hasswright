export async function api<T>(
  path: string,
  data?: unknown,
): Promise<{ status: number; body: T }> {
  // Relative URLs preserve Supervisor's /api/hassio_ingress/<session>/ prefix.
  const response = await fetch(
    `api/${path}`,
    data === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const body = await response.json();
  if (!response.ok && response.status !== 428)
    throw new Error(body.error || `Request failed (${response.status})`);
  return { status: response.status, body: body as T };
}
