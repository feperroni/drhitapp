import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "../actions";
import { PageTitle } from "../ui";

export default async function ConfigPage() {
  const s = await getSettings();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const appUrl = process.env.PUBLIC_APP_URL ?? `${proto}://${host}`;
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(appUrl, { type: "svg", margin: 2, errorCorrectionLevel: "H" }),
    QRCode.toDataURL(appUrl, { margin: 2, width: 1200, errorCorrectionLevel: "H" }),
  ]);

  const fields: [keyof typeof s, string, string?][] = [
    ["band_name", "Nome da banda"],
    ["instagram", "Instagram (sem @)"],
    ["pix_key", "Chave Pix"],
    ["pix_name", "Nome do favorecido no Pix", "Até 25 caracteres, sem acentos"],
    ["pix_city", "Cidade do favorecido no Pix", "Até 15 caracteres"],
  ];

  return (
    <div className="space-y-6">
      <PageTitle>Configurações</PageTitle>

      <section className="card grid gap-6 p-5 md:grid-cols-[auto_1fr]">
        <div className="mx-auto w-56 rounded-2xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-bold uppercase">QR Code do app</h2>
          <p className="text-sm text-muted">
            Este QR é fixo: imprima uma vez e use em todos os shows. Ele sempre abre o app no show que estiver publicado.
          </p>
          <p className="break-all font-mono text-sm text-gold">{appUrl}</p>
          <a href={qrPng} download="qrcode-drhit.png" className="btn-gold text-sm">
            Baixar QR em alta resolução (PNG)
          </a>
        </div>
      </section>

      <form action={saveSettings} className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="label sm:col-span-2">Dados da banda e Pix</h2>
        {fields.map(([key, label, hint]) => (
          <label key={key}>
            <span className="label">{label}</span>
            <input name={key} defaultValue={s[key]} className="input" />
            {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
          </label>
        ))}
        <div className="sm:col-span-2">
          <button className="btn-gold">Salvar</button>
        </div>
      </form>
    </div>
  );
}
