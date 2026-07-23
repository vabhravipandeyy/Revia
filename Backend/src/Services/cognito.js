const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminInitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GetUserAttributeVerificationCodeCommand,
  VerifyUserAttributeCommand,
  DeleteUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

async function signUpUser({ email, password }) {
  const command = new SignUpCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
  });

  const response = await client.send(command);
  return response;
}

async function confirmUserSignup({ email, confirmationCode }) {
  const command = new ConfirmSignUpCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  });

  return client.send(command);
}

async function resendSignupOtp({ email }) {
  const command = new ResendConfirmationCodeCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
  });

  return client.send(command);
}

async function loginUser({ email, password }) {
  const command = new AdminInitiateAuthCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  return client.send(command);
}

async function requestForgotPasswordOtp({ email }) {
  const command = new ForgotPasswordCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
  });

  return client.send(command);
}

async function confirmForgotPasswordOtp({ email, confirmationCode, newPassword }) {
  const command = new ConfirmForgotPasswordCommand({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
    Password: newPassword,
  });

  return client.send(command);
}

async function changeUserPassword({ accessToken, previousPassword, proposedPassword }) {
  const command = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: previousPassword,
    ProposedPassword: proposedPassword,
  });

  return client.send(command);
}

async function requestDeleteAccountOtp({ accessToken }) {
  const command = new GetUserAttributeVerificationCodeCommand({
    AccessToken: accessToken,
    AttributeName: 'email',
  });

  return client.send(command);
}

async function confirmDeleteAccount({ accessToken, confirmationCode }) {
  const verifyCommand = new VerifyUserAttributeCommand({
    AccessToken: accessToken,
    AttributeName: 'email',
    Code: confirmationCode,
  });

  await client.send(verifyCommand);

  const deleteCommand = new DeleteUserCommand({
    AccessToken: accessToken,
  });

  return client.send(deleteCommand);
}

module.exports = {
  signUpUser,
  confirmUserSignup,
  resendSignupOtp,
  loginUser,
  requestForgotPasswordOtp,
  confirmForgotPasswordOtp,
  changeUserPassword,
  requestDeleteAccountOtp,
  confirmDeleteAccount,
};
