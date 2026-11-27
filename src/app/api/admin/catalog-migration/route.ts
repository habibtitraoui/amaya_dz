import { migrateCatalogImagesHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Uploading ~20 objects can exceed the default function budget. */
export const maxDuration = 60;

export async function POST(request: Request) {
  return migrateCatalogImagesHandler(request);
}
