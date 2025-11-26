import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/android/frida/status', {
    method: 'GET',
  });
}

