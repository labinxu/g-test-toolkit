import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const response = await fetch('/auth/profile', {
    method: req.method,
    headers: {
      Authorization: req.headers.authorization || '',
    },
    credentials: 'include',
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
