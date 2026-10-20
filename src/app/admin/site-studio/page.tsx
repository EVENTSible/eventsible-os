import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { SiteStudioHomeEditor, type SiteMediaOption } from "@/components/site-studio-home-editor";
import {
  publishHomepageRevision,
  queueDriveMediaForReview,
  saveHomepageDraft,
} from "./actions";

export const metadata = { title: "Site Studio | EVENTSible HQ" };

type Revision = {
  id: string;
  revision: number;
  state: string;
  content: Record<string, unknown>;
  created_at: string;
};
type MediaCandidate = {
  id: string;
  drive_file_id: string;
  title: string;
  status: string;
};
const defaults = {
  heading: "We make more of your",
  highlight: "event possible.",
  subheading: "DJ, karaoke, interactive games, photo booths, and original experiences that make your event unforgettable.",
  portfolio_heading: "See EVENTSible in action",
  portfolio_body: "Real moments from real EVENTSible events.",
  hero_media_id: "",
};
const textField = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

export default async function SiteStudioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner") {
    redirect(auth.ok ? "/access-denied" : auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  }

  const [revisionsResult, mediaResult, candidatesResult] = await Promise.all([
    auth.supabase.from("os_site_content_revisions")
      .select("id,revision,state,content,created_at").eq("page_key", "home")
      .order("revision", { ascending: false }).limit(20),
    auth.supabase.from("os_site_media")
      .select("id,title,alt_text,public_url").eq("status", "approved")
      .eq("usage_approved", true).eq("permission_confirmed", true).order("title"),
    auth.supabase.from("os_site_media")
      .select("id,drive_file_id,title,status")
      .eq("status", "candidate").order("created_at", { ascending: false }).limit(40),
  ]);

  const unavailable = Boolean(revisionsResult.error || mediaResult.error || candidatesResult.error);
  const revisions = (revisionsResult.data ?? []) as Revision[];
  const approvedMedia = (mediaResult.data ?? []) as SiteMediaOption[];
  const candidates = (candidatesResult.data ?? []) as MediaCandidate[];
  const current = (revisions.find((r) => r.state === "draft") ??
    revisions.find((r) => r.state === "published"))?.content ?? {};
  const initial = {
    heading: textField(current.heading, defaults.heading),
    highlight: textField(current.highlight, defaults.highlight),
    subheading: textField(current.subheading, defaults.subheading),
    portfolio_heading: textField(current.portfolio_heading, defaults.portfolio_heading),
    portfolio_body: textField(current.portfolio_body, defaults.portfolio_body),
    hero_media_id: textField(current.hero_media_id, defaults.hero_media_id),
  };
  const params = searchParams ? await searchParams : {};
  const notice = params.saved ? "Private draft saved. Public site unchanged." :
    params.published ? "Selected revision published to the OS public-content reader." :
    params.queued ? "Drive candidate queued for private review. Nothing was published." :
    params.error ? "Unable to complete the request. Check input, permissions, and local database readiness." : "";

  return (
    <div className="admin-main">
      <header className="admin-header">
        <div>
          <span className="eyebrow">Website Manager</span>
          <h1>Site Studio</h1>
          <p>Edit homepage copy, preview changes instantly, and review real media without publishing unfinished work.</p>
        </div>
        <a className="secondary-button" href="https://eventsible.info" target="_blank" rel="noopener noreferrer">
          View public website
        </a>
      </header>
      {unavailable ? (
        <div role="alert" className="alert warning">
          <b>Site Studio requires its approved content schema.</b>
          <p>The Preview application is safe to visit, but editing stays disabled until the isolated database has the reviewed tables and functions.</p>
        </div>
      ) : (
        <>
          {notice && <div className="alert" role="status">{notice}</div>}
          <SiteStudioHomeEditor
            key={String(revisions[0]?.id ?? "initial")}
            initial={initial}
            approvedMedia={approvedMedia}
            saveAction={saveHomepageDraft}
          />
          <section className="panel">
            <h2>Real media from Google Drive</h2>
            <p className="panel-note">
              Queue a Google Drive file for private review. This saves only the file ID, working title, and draft description.
              It does not download, move, share, approve, or publish the photo. Do not use identifiable guest images without consent.
            </p>
            <form action={queueDriveMediaForReview} style={{ display: "grid", gap: "1rem", maxWidth: 800 }}>
              <label style={{ display: "grid", gap: "0.4rem" }}>
                Google Drive file link or ID
                <input name="drive_file" required placeholder="Paste a Drive photo/video file link" />
              </label>
              <label style={{ display: "grid", gap: "0.4rem" }}>
                Working title
                <input name="media_title" required maxLength={180} placeholder="Example: EVENTSiBLE party crowd camera" />
              </label>
              <label style={{ display: "grid", gap: "0.4rem" }}>
                Draft image description
                <textarea name="media_alt" maxLength={240} rows={2} placeholder="Describe what is shown; subject permissions reviewed later" />
              </label>
              <button className="secondary-button" type="submit">Queue for private review</button>
            </form>
            <h3>Queued candidates ({candidates.length})</h3>
            {candidates.length ? (
              <ul>
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <a
                      href={`https://drive.google.com/file/d/${encodeURIComponent(candidate.drive_file_id)}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >{candidate.title}</a>
                    {" • "}Not approved for public use
                  </li>
                ))}
              </ul>
            ) : <p>No media has been queued. The original Drive media library remains untouched.</p>}
          </section>
          <section className="panel">
            <h2>Revision history and intentional publishing</h2>
            <p className="panel-note">
              Save a private draft first. Publishing requires explicit owner action; an older revision can be republished to restore it.
            </p>
            {revisions.length ? (
              <ul>
                {revisions.map((revision) => (
                  <li key={revision.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #bbb" }}>
                    Revision {revision.revision} • {revision.state} • {new Date(revision.created_at).toLocaleString("en-US")}
                    {revision.state !== "published" && (
                      <form action={publishHomepageRevision} style={{ display: "inline", marginLeft: "1rem" }}>
                        <input type="hidden" name="revision_id" value={revision.id}/>
                        <button className="secondary-button" type="submit">Publish this revision</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p>No revisions saved yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
