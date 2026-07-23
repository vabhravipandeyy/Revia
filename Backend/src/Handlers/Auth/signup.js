const { signUpUser } = require('../../services/cognito');
const { putUserProfile } = require('../../services/users');
const {
  created,
  badRequest,
  conflict,
  internalServerError,
  parseJsonBody,
} = require('../../lib/http');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const password = body.password ? String(body.password) : '';
    const name = body.name ? String(body.name).trim() : '';
    const username = body.username ? String(body.username).trim().replace(/^@+/, '') : '';
    const gender = body.gender ? String(body.gender).trim().toLowerCase() : 'male';
    const age = body.age !== undefined && body.age !== null && body.age !== '' ? Number(body.age) : 19;
    const bio = body.bio
      ? String(body.bio).trim()
      : 'Digital explorer passionate about technology and meaningful conversations.';

    if (!email || !password) {
      return badRequest('email and password are required');
    }

    if (Number.isNaN(age) || age <= 0) {
      return badRequest('age must be a valid positive number');
    }

    const signupResponse = await signUpUser({ email, password });
    const userId = signupResponse.UserSub;
    const createdAt = new Date().toISOString();
    const fallbackUsername = email.split('@')[0].replace(/^@+/, '');
    const displayName = name || fallbackUsername.replace(/\d+$/g, '') || 'User';
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    const user = await putUserProfile({
      userId,
      email,
      name: displayName,
      username: username || fallbackUsername,
      gender,
      age,
      bio,
      avatar,
      createdAt,
    });

    return created({
      message: 'Signup successful. Verification OTP sent to email.',
      requiresVerification: true,
      user,
    });
  } catch (error) {
    console.error('Signup error', error);

    if (error.name === 'UsernameExistsException') {
      return conflict('User already exists with this email');
    }

    if (error.name === 'InvalidPasswordException') {
      return badRequest('Password does not meet Cognito policy requirements');
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return conflict('User profile already exists');
    }

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to sign up user');
  }
};
