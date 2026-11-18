import { InstallGuide } from "@/components/install-guide";

export const metadata = { title: "Install HQ | EVENTSible HQ" };

export default function InstallPage() {
  return <div className="admin-main install-main">
    <span className="eyebrow">Your existing HQ, one tap away</span>
    <h1>Install EVENTSible HQ</h1>
    <p>Open the app from your home screen or desktop. Sign in with your existing HQ account. Your role and event access stay the same.</p>
    <InstallGuide />
    <section className="panel">
      <h2>Event-day access</h2>
      <p>Keep a connection for gig details and sign-in. An offline Event-Day Pack is still in development. This installation does not save private event records to your device.</p>
      <p>On shared equipment, sign out when finished and remove the installed app if the device changes hands.</p>
      <a className="secondary-button" href="/admin/calendar">Open your calendar</a>
    </section>
  </div>;
}
