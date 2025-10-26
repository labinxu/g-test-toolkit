import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../_utils';

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/android/devices', { method: 'GET' });
}
