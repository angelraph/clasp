import { NewListing } from "./NewListing";

export default async function NewPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <NewListing initialMode={mode === "rental" ? "rental" : "sale"} />;
}
