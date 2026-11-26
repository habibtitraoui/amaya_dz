import { categoriesHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return categoriesHandler(request);
}
