import { TableRoom } from "@/components/table-room";

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TableRoom code={code} />;
}
