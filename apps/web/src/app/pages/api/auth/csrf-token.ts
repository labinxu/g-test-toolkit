import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('========csrf-token proxy');
  const response = await fetch('/auth/csrf-token', {
    method: req.method,
    credentials: 'include',
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
