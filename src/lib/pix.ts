// Gera o "Pix Copia e Cola" (BR Code estático, sem valor fixo) e o QR correspondente.

function field(id: string, value: string) {
  return id + value.length.toString().padStart(2, "0") + value;
}

function clean(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .toUpperCase()
    .slice(0, max)
    .trim();
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixPayload(key: string, name: string, city: string) {
  const payload =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", key.trim())) +
    field("52", "0000") +
    field("53", "986") +
    field("58", "BR") +
    field("59", clean(name, 25) || "DR HIT") +
    field("60", clean(city, 15) || "BRASIL") +
    field("62", field("05", "***")) +
    "6304";
  return payload + crc16(payload);
}
