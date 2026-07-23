const { getUserProfile } = require('../../services/users');
const { ok, internalServerError } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');

async function meHandler(event) {
  try {
    const claims = event.auth.claims;
    const userId = claims.sub;
    const user = await getUserProfile(userId);

    return ok({
      user: user || {
        userId,
        email: claims.username,
        name: claims.username?.split('@')[0] || 'User',
        username: claims.username?.split('@')[0] || 'user',
        gender: 'male',
        age: 19,
        bio: 'Digital explorer passionate about technology and meaningful conversations.',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          claims.username?.split('@')[0] || 'User'
        )}`,
        createdAt: null,
      },
    });
  } catch (error) {
    console.error('Get current user error', error);
    return internalServerError('Failed to fetch current user');
  }
}

exports.handler = withAuth(meHandler);
