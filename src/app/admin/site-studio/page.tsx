import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { saveHomepageDraft, publishHomepageRevision } from "./actions";

export const metadata = { title: "Site Studio | EVENTSible HQ" };
type Revision = { id: string; revision: number; state: string; content: Record<string, unknown>; created_at: string };
type Media = { id: string; title: string; alt_text: string; public_url: string };

const DEFAULTS = {
  heading: "We make more of your",
  highlight: "event possible.",
  subheading: "DJ, karaoke, interactive games, photo booths, and original experiences that make your event unforgettable.",
  portfolio_heading: "See EVENTSible in action",
  portfolio_body: "Real moments from real EVENTSible events.",
};
const field = (value: unknown, fallback: string) => typeof value === "string" ? value : fallback;

export default async function SiteStudioPage({ searchParams }: { searchParams?: Promise<Record<string,string|string[]|undefined>> }) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner")
    redirect(auth.ok ? "/access-denied" : auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  const [revisionsResult, mediaResult] = await Promise.all([
    auth.supabase.from("os_site_content_revisions")
      .select("id,revision,state,content,created_at").eq("page_key", "home")
      .order("revision", { ascending: false }).limit(20),
    auth.supabase.from("os_site_media")
      .select("id,title,alt_text,public_url").eq("status", "approved")
      .eq("usage_approved", true).eq("permission_confirmed", true).order("title"),
  ]);
  const unavailable = revisionsResult.error || mediaResult.error;
  const revisions = (revisionsResult.data ?? []) as Revision[];
  const media = (mediaResult.data ?? []) as Media[];
  const draft = revisions.find(r => r.state === "draft") ?? revisions.find(r => r.state === "published");
  const current = draft?.content ?? {};
  const params = searchParams ? await searchParams : {};
  const notice = params.saved ? "Draft saved. This has NOT changed the public site." :
    params.published ? "Revision published to the approved public-content API." :
    params.error ? "The request was not saved. Check fields, permissions, and database readiness." : "";

  return <main className="admin-main">
    <header className="admin-header">
      <div>
        <span className="eyebrow">Website Manager / First operational slice</span>
        <h1>Site Studio</h1>
        <p>Edit the EVENTSible homepage, save a private draft, then deliberately publish a revision. No page-builder chaos.</p>
      </div>
      <a className="secondary-button" href="https://eventsible.info" target="_blank" rel="noreferrer">View public website</a>
    </header>
    {unavailable ? <div role="alert" className="alert warning">
      <b>Site Studio is not yet connected.</b>
      <p>The reviewed OS content schema must be approved and deployed before editing is enabled. No records or public pages were changed.</p>
    </div> : <>
      {notice && <div className="alert" role="status">{notice}</div>}
      <section className="panel">
        <h2>Homepage content</h2>
        <form action={saveHomepageDraft} className="site-studio-form" style={{display:"grid",gap:"1rem",maxWidth:800}}>
          <label>Headline <input name="heading" required maxLength={110} defaultValue={field(current.heading, DEFAULTS.heading)} /></label>
          <label>Highlighted words <input name="highlight" required maxLength={70} defaultValue={field(current.highlight, DEFAULTS.highlight)} /></label>
          <label>Introduction <textarea name="subheading" required maxLength={600} rows={4} defaultValue={field(current.subheading, DEFAULTS.subheading)} /></label>
          <label>Portfolio heading <input name="portfolio_heading" maxLength={140} defaultValue={field(current.portfolio_heading, DEFAULTS.portfolio_heading)} /></label>
          <label>Portfolio description <textarea name="portfolio_body" maxLength={600} rows={3} defaultValue={field(current.portfolio_body, DEFAULTS.portfolio_body)} /></label>
          <label>Approved homepage photo
            <select name="hero_media_id" defaultValue={String(current.hero_media_id ?? "")}>
              <option value="">Keep existing image</option>
              {media.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <p className="panel-note">Only reviewed, permission-cleared, public-ready media appears here. Drive originals remain private. {media.length} approved choices available.</p>
          <button className="primary-button" type="submit">Save private draft</button>
        </form>
      </section>
      <section className="panel">
        <h2>Revisions and deliberate publishing</h2>
        <p className="panel-note">Publishing changes the public-content API only after a separately approved deployment/database rollout. Restore an older version by re-publishing it.</p>
        {revisions.length === 0 ? <p>No drafts yet.</p> : <ul>
          {revisions.map(r => <li key={r.id} style={{padding:"0.75rem 0",borderBottom:"1px solid #bbb"}}>
            Revision {r.revision} | {r.state} | {new Date(r.created_at).toLocaleString("en-US")}
            {r.state !== "published" && <form action={publishHomepageRevision} style={{display:"inline",marginLeft:"1rem"}}>
              <input type="hidden" name="revision_id" value={r.id}/>
              <button type="submit" className="secondary-button">Publish this revision</button>
            </form>}
          </li>)}
        </ul>}
      </section>
    </>}
  </main>;
}
