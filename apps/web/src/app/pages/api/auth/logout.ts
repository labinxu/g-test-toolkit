import { NextApiRequest, NextApiResponse } from 'next';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('=====logout');
  const response = await fetch('/auth/logout', {
    method: req.method,
    credentials: 'include',
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
