import Link from "next/link";

export const metadata = { title: "Connected tools | EVENTSible HQ" };

export default function ConnectedToolsPage() {
  return <div className="admin-main install-main">
    <span className="eyebrow">One HQ, connected destinations</span>
    <h1>Connected tools</h1>
    <p>Start with the booked Gig Workspace for event-specific work. These links use the existing routes and services. Access still depends on your HQ role and each tool&apos;s own permissions.</p>
    <div className="install-grid">
      <article className="panel"><h2>Mission Control and leads</h2><p>Review inquiries, quotes, and booked gigs in HQ.</p><Link className="secondary-button" href="/admin#lead-review">Review leads</Link></article>
      <article className="panel"><h2>Calendar and assigned gigs</h2><p>Use Master Calendar or My Schedule, then open the canonical Gig Workspace.</p><Link className="secondary-button" href="/admin/calendar">Open calendar</Link></article>
      <article className="panel"><h2>Wedding Hero and Event Hero</h2><p>Open the staff review from a linked Hero workspace. The November 7 submission needs Owner reconciliation before it appears on the booked Gig.</p><Link className="secondary-button" href="/admin#hero-workspaces">Review Hero plans</Link></article>
      <article className="panel"><h2>Staff, tasks, equipment, and music</h2><p>Use the event sections in Gig Workspace. Wedding Hero operations review includes a read-only music cue list when a plan is linked.</p><Link className="secondary-button" href="/admin#gig-workspace">Open gigs</Link></article>
      <article className="panel"><h2>Event Builder</h2><p>Public client quote and planning intake.</p><a className="secondary-button" href="https://build.eventsible.info/build?start=choose">Open Builder</a></article>
      <article className="panel"><h2>VINCE live experience</h2><p>Open the existing live event app. Booth Console remains a separate local tool; HQ does not expose a Host PIN.</p><a className="secondary-button" href="https://eventsible.app">Open VINCE</a></article>
    </div>
    <p>Site Studio is in the Owner menu. Custom Creations does not have a verified HQ workspace yet.</p>
  </div>;
}
