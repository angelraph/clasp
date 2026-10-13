import { DealRoom } from "./DealRoom";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string; error?: string }>;
}) {
  const { id } = await params;
  const { k, error } = await searchParams;
  return <DealRoom id={id} urlKey={k ?? null} initialError={error ?? null} />;
}
