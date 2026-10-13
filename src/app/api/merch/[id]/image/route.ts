import { sql } from "@/lib/db";

/** Foto de um item da loja (guardada no banco). A URL leva ?v=<updated_at> para invalidar cache. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const [row] = await sql<{ image: Buffer | null; image_type: string | null }[]>`
    select image, image_type from merch_items where id = ${id}`;
  if (!row?.image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.image), {
    headers: {
      "Content-Type": row.image_type ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
