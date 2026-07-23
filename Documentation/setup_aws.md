# AWS Setup Guide

## Purpose

This file explains how to set up AWS for the Revia backend using only free-tier friendly services.

## Services you will use

- AWS Cognito
- AWS Lambda
- API Gateway REST API
- DynamoDB
- S3

## 1. Create or prepare your AWS account

- Sign in to AWS
- Use a free-tier eligible account
- Choose one region and stay consistent
- Recommended example region: `ap-south-1` or `us-east-1`

## 2. Install required local tools

Install:

- Node.js 20+
- AWS CLI
- AWS SAM CLI

Verify:

```bash
node -v
aws --version
sam --version
```

## 3. Configure AWS CLI

Run:

```bash
aws configure
```

Provide:

- AWS Access Key ID
- AWS Secret Access Key
- Default region
- Output format as `json`

## 4. Install backend dependencies

From project root:

```bash
cd backend
npm install
```

## 5. Deploy the backend stack

Run:

```bash
sam build
sam deploy --guided
```

Suggested guided values:

- Stack Name: `revia-phase1-backend`
- AWS Region: your chosen region
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Disable rollback: `N`
- Save arguments to configuration file: `Y`

## 6. Resources created by deployment

`template.yaml` creates:

- Cognito User Pool
- Cognito App Client
- DynamoDB users table
- DynamoDB agents table
- DynamoDB messages table
- DynamoDB uploads metadata table
- S3 uploads bucket
- API Gateway REST API
- Lambda functions for auth, users, agents, and messages

The Cognito app client in this project is configured for:

- access token validity: 1 day
- ID token validity: 1 day
- refresh token validity: 30 days

## 7. Get deployment outputs

After deploy, get stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name revia-phase1-backend \
  --query "Stacks[0].Outputs"
```

Important outputs:

- `ApiBaseUrl`
- `UserPoolId`
- `UserPoolClientId`
- `UsersTableName`
- `AgentsTableName`
- `MessagesTableName`
- `UploadsTableName`
- `UploadsBucketName`

## 8. Test the endpoints

### Signup

```bash
curl -X POST "$API_BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "StrongPass123"
  }'
```

### Login

```bash
curl -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "StrongPass123"
  }'
```

### Current user

```bash
curl "$API_BASE_URL/auth/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 9. Frontend environment you should keep

Your frontend should store:

- API base URL
- access token

Example:

```ts
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com/dev';
```

## 10. AWS free-tier safety notes

- Lambda free tier is enough for early auth traffic.
- API Gateway usage should stay small during development.
- DynamoDB uses `PAY_PER_REQUEST`, which is good for low usage.
- Cognito is fine for small early-stage auth usage, but you should still monitor costs.
- S3 bucket is private and only meant for future upload usage.

## 11. Recommended next step after setup

After deploy succeeds:

1. Connect frontend login/register to these endpoints.
2. Save access token after login.
3. Call `/auth/me` on app load to restore session.
4. Add logout by removing local token.
5. Create personas through `/agents`.
6. Store chat history through `/messages`.
7. Prepare browser uploads through `/upload` and then PUT directly to S3 using the returned pre-signed URL.
