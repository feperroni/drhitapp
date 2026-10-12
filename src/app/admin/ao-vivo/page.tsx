import LivePanel from "./LivePanel";

export default function AoVivoPage() {
  return <LivePanel vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />;
}
