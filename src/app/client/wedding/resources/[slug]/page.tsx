import Link from "next/link";
import { notFound } from "next/navigation";
import { WeddingHeroMark } from "@/components/wedding-hero-mark";
import { WeddingResourceWorksheet } from "@/components/wedding-resource-worksheet";
import { getWeddingResource, WEDDING_RESOURCES } from "@/lib/wedding-resources";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return WEDDING_RESOURCES.map((resource) => ({ slug: resource.slug }));
}

export default async function WeddingResourcePage({ params }: PageProps) {
  const { slug } = await params;
  const resource = getWeddingResource(slug);
  if (!resource) notFound();

  return (
    <main className="wedding-resource-workspace">
      <nav className="wedding-resource-nav">
        <Link href="/client/login"><WeddingHeroMark compact /></Link>
        <div><Link href="/client/wedding/resources">All resources</Link><Link href="/client/wedding?mode=guided">Open the planner</Link></div>
      </nav>
      <header className="wedding-resource-page-hero">
        <div className="wedding-resource-icon" aria-hidden="true">{resource.icon}</div>
        <div><span className="wedding-kicker">{resource.category} · {resource.badge}</span><h1>{resource.title}</h1><p>{resource.description}</p></div>
      </header>
      <WeddingResourceWorksheet resource={resource} />
    </main>
  );
}
