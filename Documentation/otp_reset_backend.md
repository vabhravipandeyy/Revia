# OTP Reset Backend

## Overview

This document covers the backend flows added for:

- forgot password with email OTP
- in-session password change
- OTP-confirmed account deletion

The implementation uses AWS Cognito and the existing serverless backend.

## Endpoints

### `POST /auth/forgot-password/request`

Starts the forgot-password flow and sends an OTP to the user's email through Cognito.

Request:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "message": "OTP sent to your email"
}
```

### `POST /auth/forgot-password/confirm`

Confirms the OTP and sets the new password.

Request:

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "StrongPass123"
}
```

Response:

```json
{
  "message": "Password reset successful"
}
```

### `POST /auth/change-password`

Changes password for a logged-in user using the access token.

Header:

```text
Authorization: Bearer <accessToken>
```

Request:

```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123"
}
```

Response:

```json
{
  "message": "Password changed successfully"
}
```

### `POST /users/delete-account/request`

Sends an email OTP before account deletion.

Header:

```text
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "message": "Delete account OTP sent to your email"
}
```

### `POST /users/delete-account/confirm`

Confirms the deletion OTP and removes the Cognito user plus DynamoDB user profile.

Header:

```text
Authorization: Bearer <accessToken>
```

Request:

```json
{
  "otp": "123456"
}
```

Response:

```json
{
  "message": "Account deleted successfully"
}
```

## Backend files added or updated

### Cognito service methods

- `backend/src/services/cognito.js`

Added:

- forgot password request
- forgot password confirm
- change password
- delete-account OTP request
- delete-account OTP confirm + Cognito user delete

### New handlers

- `backend/src/handlers/auth/forgot-password-request.js`
- `backend/src/handlers/auth/forgot-password-confirm.js`
- `backend/src/handlers/auth/change-password.js`
- `backend/src/handlers/users/delete-account-request.js`
- `backend/src/handlers/users/delete-account-confirm.js`

### User data cleanup

- `backend/src/services/users.js`

Added DynamoDB profile deletion so app data is removed when the account is deleted.

### Infrastructure

- `backend/template.yaml`

Added API Gateway routes and Lambda resources for all the new flows.

## Frontend behavior

### Login page

The `Lost?` action now opens a forgot-password dialog:

1. user enters email
2. user requests OTP
3. OTP arrives in email
4. user enters OTP and new password
5. password resets successfully

### Profile page

`Change Password`:

- asks for current password
- asks for new password
- applies Cognito password policy validation

`Delete Account`:

- sends OTP to email
- requires OTP confirmation
- deletes Cognito account
- deletes DynamoDB profile
- logs user out

## Important deploy note

These features require backend redeploy after code changes:

```bash
cd backend
sam build
sam deploy
```

## Notes

- Password reset OTP emails are handled by Cognito.
- Change password is authenticated and does not require email OTP.
- Delete account is protected by an email OTP confirmation step.
