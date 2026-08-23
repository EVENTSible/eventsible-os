import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyWeddingHeroEntry({ searchParams }: PageProps) {
  const query = await searchParams;
  const forwarded = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => forwarded.append(key, item));
    else if (value) forwarded.set(key, value);
  }

  const suffix = forwarded.size ? `?${forwarded.toString()}` : "";
  redirect(`/weddinghero${suffix}`);
}
