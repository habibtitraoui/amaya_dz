import { createOrderHandler, myOrdersHandler } from '@/lib/api/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return myOrdersHandler(request);
}

export async function POST(request: Request) {
  return createOrderHandler(request);
}
