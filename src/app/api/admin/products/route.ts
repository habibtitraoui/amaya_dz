import { createProductHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return createProductHandler(request);
}
