import { sql } from "./db";

export type Settings = {
  band_name: string;
  instagram: string;
  pix_key: string;
  pix_name: string;
  pix_city: string;
};

export async function getSettings(): Promise<Settings> {
  const rows = await sql<{ key: string; value: string }[]>`select key, value from settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Settings;
}
