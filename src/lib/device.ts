import { cookies } from "next/headers";

const COOKIE = "dh_device";

/** Identificador anônimo do celular da pessoa (cookie de 2 anos). */
export async function getDeviceId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 730, path: "/" });
  }
  return id;
}
