# Revia Backend

Serverless backend for Revia built with AWS free-tier friendly core services:

- AWS Lambda
- API Gateway REST API
- AWS Cognito
- DynamoDB
- S3 reserved for later uploads

## What this backend includes

### Phase 1 auth and user flows

- `POST /auth/signup`
- `POST /auth/signup/verify`
- `POST /auth/signup/resend-otp`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/forgot-password/request`
- `POST /auth/forgot-password/confirm`
- `POST /auth/change-password`
- `PUT /users/me`
- `POST /users/delete-account/request`
- `POST /users/delete-account/confirm`

### Phase 2 persona and chat flows

- `POST /agents`
- `GET /agents`
- `GET /agents/{id}`
- `PUT /agents/{id}`
- `DELETE /agents/{id}`
- `POST /messages`
- `GET /messages/{agentId}`
- `POST /personas`
- `GET /personas`
- `GET /personas/{id}`
- `PUT /personas/{id}`
- `DELETE /personas/{id}`
- `POST /chat/send`
- `GET /chat/history/{conversationId}`

### Upload flow

- `POST /upload`

## Core data tables

- `Users`
- `Agents`
- `Messages`

## Folder structure

```text
backend/
  package.json
  template.yaml
  .env.example
  src/
    handlers/
      auth/
      agents/
      messages/
      users/
    lib/
      http.js
      withAuth.js
    services/
      cognito.js
      users.js
      agents.js
      messages.js
```

## Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS SAM CLI installed

## Install

```bash
cd backend
npm install
```

## Validate handler syntax

```bash
npm run check
```

## Build with SAM

```bash
npm run build
```

## Deploy

```bash
npm run deploy:guided
```

Suggested guided values:

- Stack name: `revia-backend`
- AWS region: your chosen free-tier-friendly region
- Confirm changes before deploy: `Y`
- Allow SAM IAM role creation: `Y`
- Save arguments to `samconfig.toml`: `Y`

## Lambda environment variables

Injected from `template.yaml`:

- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `USERS_TABLE`
- `AGENTS_TABLE`
- `MESSAGES_TABLE`
- `MEMORIES_TABLE`
- `UPLOADS_TABLE`
- `UPLOADS_BUCKET`
- `COGNITO_AUTO_CONFIRM`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GROQ_FALLBACK_MODEL`
- `DEFAULT_MODEL_PROVIDER`
- `DEFAULT_MODEL_NAME`
- `MEMORY_SUMMARY_INTERVAL`
- `MEMORY_RETRIEVAL_LIMIT`

## Phase 2 data model

### Agents

- `agentId`
- `userId`
- `name`
- `gender`
- `age`
- `language`
- `traits`
- `conversationStyle`
- `personaConfig`
- `createdAt`
- `updatedAt`

Agents table key design:

- partition key: `userId`
- sort key: `agentId`

### Messages

- `messageId`
- `agentId`
- `userId`
- `role`
- `text`
- `timestamp`
- `messageKey`

Messages table key design:

- partition key: `userId`
- sort key: `messageKey`

`messageKey` is stored like:

```text
AGENT#{agentId}#TS#{timestamp}#MSG#{messageId}
```

This keeps full chat history queryable per user and per agent without scans.

### Memories

- `memoryId`
- `personaId`
- `summary`
- `embeddingText`
- `tags`
- `createdAt`

Memories table key design:

- partition key: `userId`
- sort key: `memoryKey`

This powers lightweight contextual recall without needing a paid vector database.

## API examples

### Create an agent

```bash
curl -X POST "$API_BASE_URL/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Aisha",
    "gender": "female",
    "age": 24,
    "language": "English",
    "traits": ["empathetic", "curious"],
    "conversationStyle": "warm and supportive",
    "personaConfig": {
      "tone": "friendly"
    }
  }'
```

### Store a message

```bash
curl -X POST "$API_BASE_URL/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "agentId": "YOUR_AGENT_ID",
    "role": "user",
    "text": "Hello there"
  }'
```

### Read an agent's chat history

```bash
curl "$API_BASE_URL/messages/YOUR_AGENT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Send a persona chat message

```bash
curl -X POST "$API_BASE_URL/chat/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "personaId": "YOUR_PERSONA_ID",
    "conversationId": "YOUR_PERSONA_ID",
    "message": "Remember Goa?"
  }'
```

### Read persona chat history

```bash
curl "$API_BASE_URL/chat/history/YOUR_PERSONA_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Prepare a file upload

```bash
curl -X POST "$API_BASE_URL/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "fileName": "conversation-log.txt",
    "fileType": "text/plain"
  }'
```

Response:

```json
{
  "uploadUrl": "presigned-put-url",
  "fileId": "uuid",
  "fileUrl": "https://bucket.s3.region.amazonaws.com/users/..."
}
```

## Ownership and security rules

- all protected routes validate JWTs using Cognito
- every agent belongs to one authenticated user
- every stored message belongs to one authenticated user and one agent
- every chat reply is generated using persona traits, recent messages, and relevant stored memories
- every prepared upload belongs to one authenticated user
- agent deletion removes that user’s stored messages for the same agent
- no mock persistence is used

## Documentation

- [documentation/phase1_backend.md](../documentation/phase1_backend.md)
- [documentation/phase2_backend.md](../documentation/phase2_backend.md)
- [documentation/otp_reset_backend.md](../documentation/otp_reset_backend.md)
- [documentation/setup_aws.md](../documentation/setup_aws.md)

## Notes

- Password handling stays inside Cognito.
- DynamoDB uses `PAY_PER_REQUEST` for low-traffic friendliness.
- S3 is still private and reserved for later upload work.
- Phase 2 only stores persona config and chat history.
- On a fresh user account, the first `/personas` request auto-seeds the original Revia default persona pack into DynamoDB.
- Gemini powers the current AI response path through a model-wrapper layer.
- LLM response generation can later switch providers through the same wrapper architecture without changing storage or handlers.
