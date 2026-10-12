import QRCode from "qrcode";
import { getCatalog } from "@/lib/catalog";
import { pixPayload } from "@/lib/pix";
import { getSettings } from "@/lib/settings";
import AudienceApp from "./AudienceApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const pix = pixPayload(settings.pix_key, settings.pix_name, settings.pix_city);
  const pixSvg = await QRCode.toString(pix, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });

  return (
    <AudienceApp
      bandName={settings.band_name}
      instagram={settings.instagram}
      pix={{ payload: pix, svg: pixSvg, key: settings.pix_key, name: settings.pix_name }}
      catalog={catalog}
    />
  );
}
