import { NextApiRequest, NextApiResponse } from 'next';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('==========login proxy');
  console.log(req.body);
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: req.body,
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.cookie || '', // Forward client cookies (_csrf)
    },
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
