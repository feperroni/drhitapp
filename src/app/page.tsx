import QRCode from "qrcode";
import { getCatalog } from "@/lib/catalog";
import { sql } from "@/lib/db";
import { pixPayload } from "@/lib/pix";
import { getSettings } from "@/lib/settings";
import AudienceApp from "./AudienceApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, catalog, agenda] = await Promise.all([
    getSettings(),
    getCatalog(),
    // Agenda: show ao vivo + próximos shows divulgados (de hoje em diante, no fuso de SP)
    sql<{ id: number; date: string; venue: string; start: string | null; end: string | null; live: boolean }[]>`
      select id, show_date as date, venue, start_time::text as start, end_time::text as end, status = 'live' as live
      from shows
      where status = 'live'
         or (announce and status <> 'closed' and show_date >= (now() at time zone 'America/Sao_Paulo')::date)
      order by status = 'live' desc, show_date, start_time nulls last
      limit 20`,
  ]);
  const pix = pixPayload(settings.pix_key, settings.pix_name, settings.pix_city);
  const pixSvg = await QRCode.toString(pix, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });

  return (
    <AudienceApp
      bandName={settings.band_name}
      instagram={settings.instagram}
      pix={{ payload: pix, svg: pixSvg, key: settings.pix_key, name: settings.pix_name }}
      catalog={catalog}
      agenda={agenda}
    />
  );
}
