import Link from "next/link";
import { WeddingHeroMark } from "@/components/wedding-hero-mark";
import { WeddingQuestionnaire } from "@/components/wedding-questionnaire";

export const metadata = {
  title: "Start Your Wedding Hero | EVENTSible",
  description: "Start planning your wedding immediately with no account or email required.",
};

type PageProps = { searchParams: Promise<{ mode?: string | string[]; view?: string | string[] }> };

export default async function PublicWeddingHeroPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const requestedMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const initialMode = requestedMode === "form" || requestedMode === "print" ? requestedMode : "guided";
  const initialPrintView = requestedView === "day-of" ? "day-of" : "planner";

  return (
    <div className="wedding-shell wedding-public-shell">
      <nav className="wedding-nav wedding-public-nav">
        <div><WeddingHeroMark compact /><span>Interactive Wedding Companion</span></div>
        <div className="client-nav-actions">
          <Link href="/client/wedding/resources">Wedding resources</Link>
          <Link href="/client/login">Change planning method</Link>
          <Link href="/client/login#hero-access">Open a saved plan</Link>
        </div>
      </nav>
      <header className="wedding-hero wedding-public-hero">
        <div>
          <span className="wedding-kicker">Your Wedding Hero draft</span>
          <h1>Let&apos;s get the useful stuff down.</h1>
          <p>Songs, wedding-party names, ceremony cues, timing, and everything your DJ needs. Start anywhere.</p>
        </div>
        <div className="wedding-save-promise wedding-public-promise">
          <b>No account or email required</b>
          <span>Your answers save on this device while you work. Print or save a PDF whenever you are ready.</span>
        </div>
      </header>
      <WeddingQuestionnaire
        initialAnswers={{}}
        initialProgress={0}
        initialMode={initialMode}
        initialPrintView={initialPrintView}
        publicDraft
      />
    </div>
  );
}
