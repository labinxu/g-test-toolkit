import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function POST(req: NextRequest) {
  return proxyJsonWithReq(req, '/android/appium/stop', {
    method: 'POST',
  });
}
