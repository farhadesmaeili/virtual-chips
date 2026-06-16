import { notFound } from 'next/navigation';
import { TablePreview } from '@/presentation/components/table-preview';

// A development-only surface for reviewing the table + action panel (tasks
// 4.2/4.3). Not part of the product; returns 404 in production so it never ships.

export default function TablePreviewPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TablePreview />;
}
