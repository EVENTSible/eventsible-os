"use client";
import type { ComponentProps } from "react";
import { formatRevisionTime } from "@/lib/revision-time";
import { SiteStudioEditor } from "./site-studio-editor";
import { SiteStudioMediaIntake } from "./site-studio-media-intake";
export type SiteStudioViewProps = ComponentProps<typeof SiteStudioEditor> & {
 unavailable: boolean; before?: number; notice: string; hasOlder: boolean;
 revisions: {id:string;revision:number;state:string;created_at:string}[];
 candidates: {id:string;drive_file_id:string;title:string;status:string}[];
 queueAction: ComponentProps<typeof SiteStudioMediaIntake>["action"];
 publishAction: (formData:FormData)=>Promise<void>;
};
export function SiteStudioView({initial,approvedMedia,saveAction,unavailable,before,notice,hasOlder,revisions,candidates,queueAction,publishAction}:SiteStudioViewProps) {
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
          {before ? <p><a href="/admin/site-studio">Back to current editor</a></p> : <>
          <SiteStudioEditor
            key={String(revisions[0]?.id ?? "initial")}
            initial={initial}
            approvedMedia={approvedMedia}
            saveAction={saveAction}
          />
          <section className="panel">
            <h2>Real media from Google Drive</h2>
            <p className="panel-note">
              Queue a Google Drive file for private review. This saves only the file ID, working title, and draft description.
              It does not download, move, share, approve, or publish the photo. Do not use identifiable guest images without consent.
            </p>
            <SiteStudioMediaIntake action={queueAction} />
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
          </>}
          <section className="panel">
            <h2>Revision history and intentional publishing</h2>
            <p className="panel-note">
              Save a private draft first. Publishing requires explicit owner action; an older revision can be republished to restore it.
            </p>
            {revisions.length ? (
              <form action={publishAction}>
              <ul>
                {revisions.map((revision) => (
                  <li key={revision.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #bbb" }}>
                    Revision {revision.revision} • {revision.state} • {formatRevisionTime(revision.created_at)}
                    {revision.state !== "published" && (
                      <button className="secondary-button" type="submit" name="revision_id" value={revision.id}
                        style={{ marginLeft: "1rem" }}>Publish this revision</button>
                    )}
                  </li>
                ))}
              </ul>
              </form>
            ) : <p>No revisions saved yet.</p>}
            {hasOlder && <a href={`/admin/site-studio?before=${revisions.at(-1)!.revision}`}>Older revisions</a>}
          </section>
        </>
      )}
    </div>
  );
}
