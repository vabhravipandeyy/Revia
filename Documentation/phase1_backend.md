# Phase 1 Backend

## Goal

Phase 1 delivers a real serverless authentication backend for Revia using only AWS free-tier friendly core services.

## Services used

- AWS Lambda for backend logic
- API Gateway REST API for public endpoints
- AWS Cognito for authentication and JWT issuing
- DynamoDB for minimal user profile storage
- S3 bucket provisioned now for later upload features

## Implemented endpoints

### `POST /auth/signup`

Creates a Cognito user with `email + password`, auto-confirms the user from the backend, and stores a minimal profile in DynamoDB.

Stored profile:

- `userId`
- `email`
- `createdAt`

### `POST /auth/login`

Authenticates against Cognito and returns JWT tokens:

- `accessToken`
- `idToken`
- `refreshToken`
- `expiresIn`
- `tokenType`

### `GET /auth/me`

Protected endpoint that validates the Cognito access token and returns the current minimal user profile from DynamoDB.

## Backend flow

### Signup

1. Frontend sends `email` and `password` to `POST /auth/signup`
2. API Gateway invokes Lambda
3. Lambda calls Cognito `SignUp`
4. Lambda auto-confirms the user
5. Lambda stores minimal user record in DynamoDB
6. API returns created user profile

### Login

1. Frontend sends `email` and `password` to `POST /auth/login`
2. API Gateway invokes Lambda
3. Lambda calls Cognito `AdminInitiateAuth`
4. Cognito returns JWTs
5. API returns JWT payload to frontend

### Current user

1. Frontend sends `Authorization: Bearer <accessToken>`
2. API Gateway invokes Lambda
3. Auth wrapper verifies JWT using Cognito public keys
4. Lambda reads profile from DynamoDB
5. API returns current user profile

## JWT validation middleware

JWT validation is implemented in:

- `backend/src/lib/withAuth.js`

It:

- extracts the bearer token
- verifies it using `aws-jwt-verify`
- rejects missing or invalid tokens with `401`
- injects verified claims into `event.auth`

## Code structure

### Infrastructure

- `backend/template.yaml`

### Handlers

- `backend/src/handlers/auth/signup.js`
- `backend/src/handlers/auth/login.js`
- `backend/src/handlers/auth/me.js`

### Shared helpers

- `backend/src/lib/http.js`
- `backend/src/lib/withAuth.js`

### AWS service wrappers

- `backend/src/services/cognito.js`
- `backend/src/services/users.js`

## Security notes

- Passwords are never manually hashed in Lambda because Cognito securely handles password storage.
- JWT validation is done server-side for protected routes.
- DynamoDB stores only minimal profile data in Phase 1.
- S3 bucket is private by default.
- API responses return proper `400`, `401`, `409`, and `500` status codes where relevant.

## Frontend requirements

Frontend should:

- store the `accessToken` after login
- send `Authorization: Bearer <accessToken>` on protected requests

Example:

```ts
const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
  }),
});

const loginData = await loginRes.json();
localStorage.setItem('revia_access_token', loginData.tokens.accessToken);

const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
  headers: {
    Authorization: `Bearer ${localStorage.getItem('revia_access_token')}`,
  },
});
```

## What is ready now

- Real signup with Cognito
- Real login with Cognito
- Real JWT issuance
- Access token and ID token validity configured for 1 day in infrastructure
- Real protected `me` endpoint
- Real DynamoDB user profile storage
- Real deployable serverless backend with AWS SAM

## What can be added in Phase 2

- refresh token endpoint
- logout / token revocation
- forgot password / reset password
- email verification flow
- user roles
- S3 signed upload URLs
- Gemini or Bedrock chat APIs
