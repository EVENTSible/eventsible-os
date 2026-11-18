import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Tools | EVENTSible HQ" };

export default async function ConnectedToolsPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const role = auth.user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/access-denied");
  const owner = role === "owner";
  return <div className="admin-main hq-board">
    <header className="hq-page-heading"><div><span className="eyebrow">Connected work</span><h1>Tools</h1><p>Open the existing HQ routes and live EVENTSible services.</p></div></header>
    <div className="hq-tool-grid">
      <Link href="/admin/mission-control" className="hq-tool-card"><span>Business</span><h2>Mission Control</h2><p>Leads, quotes and approvals. Editing controls follow your role.</p><b>Open →</b></Link>
      <Link href="/admin/mission-control#hero-workspaces" className="hq-tool-card"><span>Client planning</span><h2>Wedding & Event Hero</h2><p>Review submitted plans and original answers.</p><b>Open →</b></Link>
      <Link href="/admin/gigs" className="hq-tool-card"><span>Operations</span><h2>Gigs</h2><p>Booked services, music, crew, tasks and event documents.</p><b>Open →</b></Link>
      {owner ? <Link href="/admin/quick-add" className="hq-tool-card"><span>Owner</span><h2>Quick Add</h2><p>Record a real contact, lead or gig.</p><b>Open →</b></Link> : null}
      {owner ? <Link href="/admin/site-studio" className="hq-tool-card"><span>Owner</span><h2>Site Studio</h2><p>Edit the existing website workspace.</p><b>Open →</b></Link> : null}
      {owner ? <Link href="/admin/data-readiness" className="hq-tool-card"><span>Owner</span><h2>Records & Intake</h2><p>Review imports and data readiness.</p><b>Open →</b></Link> : null}
      <Link href="/admin/imports" className="hq-tool-card"><span>Review</span><h2>Imports</h2><p>Inspect imported event candidates.</p><b>Open →</b></Link>
      <Link href="/admin/install" className="hq-tool-card"><span>Workspace</span><h2>Install HQ</h2><p>Device instructions for the existing app.</p><b>Open →</b></Link>
      <a href="https://build.eventsible.info/build?start=choose" className="hq-tool-card"><span>Public service</span><h2>Event Builder</h2><p>Open the existing quote and planning intake.</p><b>Open ↗</b></a>
      <a href="https://eventsible.app" className="hq-tool-card"><span>Live experience</span><h2>VINCE</h2><p>Open the separate event experience app.</p><b>Open ↗</b></a>
    </div>
  </div>;
}
