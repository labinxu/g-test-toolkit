import Cookies from 'js-cookie';
export const RefreshToken = async (): Promise<string> => {
  const refreshToken = Cookies.get('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    if (response.ok) {
      Cookies.set('accessToken', data.accessToken, {
        expires: 1,
        secure: true,
        sameSite: 'strict',
      });
      Cookies.set('refreshToken', data.refreshToken, {
        expires: 7,
        secure: true,
        sameSite: 'strict',
      });

      return data.accessToken;
    } else {
      throw new Error(data.message || 'Failed to refresh token');
    }
  } catch (error) {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    throw error;
  }
};
