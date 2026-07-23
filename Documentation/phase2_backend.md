# Phase 2 Backend

## Goal

Phase 2 builds the core Revia data layer for persona management and chat history using only AWS free-tier friendly services.

Services used:

- AWS Lambda
- API Gateway REST API
- DynamoDB

Auth remains the same from Phase 1:

- AWS Cognito
- JWT-protected endpoints

## What is implemented

### Agents APIs

- `POST /agents`
- `GET /agents`
- `GET /agents/{id}`
- `PUT /agents/{id}`
- `DELETE /agents/{id}`

### Messages APIs

- `POST /messages`
- `GET /messages/{agentId}`

### Upload API

- `POST /upload`

### AI chat APIs

- `POST /chat/send`
- `GET /chat/history/{conversationId}`

### Persona APIs

- `POST /personas`
- `GET /personas`
- `GET /personas/{id}`
- `PUT /personas/{id}`
- `DELETE /personas/{id}`

All endpoints use real DynamoDB persistence only.
No mock data is used.
For new users, the backend auto-seeds the original Revia default persona set on the first persona fetch so the app is not empty after login.

## Data model

### Users table

Existing Phase 1 table:

- `userId`
- `email`
- profile fields

### Agents table

Table name:

- `revia-agents-dev`

Key design:

- partition key: `userId`
- sort key: `agentId`

Stored fields:

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

This keeps every user’s personas grouped together and supports fast listing with a single DynamoDB query.

### Messages table

Table name:

- `revia-messages-dev`

Key design:

- partition key: `userId`
- sort key: `messageKey`

Stored fields:

- `messageId`
- `agentId`
- `userId`
- `role`
- `text`
- `timestamp`
- `messageKey`

`messageKey` format:

```text
AGENT#{agentId}#TS#{timestamp}#MSG#{messageId}
```

This allows efficient per-user, per-agent history reads using:

- `userId = :userId`
- `begins_with(messageKey, 'AGENT#{agentId}#')`

### Uploads metadata table

Table name:

- `revia-uploads-meta-dev`

Key design:

- partition key: `userId`
- sort key: `fileId`

Stored fields:

- `fileId`
- `userId`
- `fileName`
- `fileType`
- `objectKey`
- `fileUrl`
- `status`
- `createdAt`
- `updatedAt`

## Ownership rules

- every agent belongs to exactly one user
- every message belongs to one user and one agent
- message creation first checks that the agent belongs to the authenticated user
- agent reads, updates, and deletes are scoped by authenticated `userId`
- deleting an agent also deletes that agent’s stored messages for the same user

## Request/response behavior

### `POST /agents`

Creates a persona record.

Request example:

```json
{
  "name": "Aisha",
  "gender": "female",
  "age": 24,
  "language": "English",
  "traits": ["empathetic", "curious"],
  "conversationStyle": "warm and supportive",
  "personaConfig": {
    "tone": "friendly",
    "memoryMode": "full-history"
  }
}
```

Response:

```json
{
  "message": "Agent created successfully",
  "agent": {
    "agentId": "uuid",
    "userId": "cognito-sub"
  }
}
```

### `GET /agents`

Returns all personas for the authenticated user.

### `GET /agents/{id}`

Returns one persona if it belongs to the authenticated user.

### `PUT /agents/{id}`

Updates editable persona fields and returns the updated record.

### `DELETE /agents/{id}`

Deletes the persona and its stored chat history for that user.

### `POST /messages`

Stores one message in chat history.

Request example:

```json
{
  "agentId": "agent-uuid",
  "role": "user",
  "text": "Hello, how are you?"
}
```

Valid roles:

- `user`
- `ai`

### `GET /messages/{agentId}`

Returns the full stored chat history for that agent, ordered oldest to newest.

### `POST /upload`

Creates a user-scoped upload session for direct S3 transfer.

Request example:

```json
{
  "fileName": "notes.txt",
  "fileType": "text/plain"
}
```

Response:

```json
{
  "uploadUrl": "presigned-put-url",
  "fileId": "uuid",
  "fileUrl": "https://bucket.s3.region.amazonaws.com/users/..."
}
```

## Files added

### Infrastructure

- `backend/template.yaml`

### Services

- `backend/src/services/agents.js`
- `backend/src/services/messages.js`
- `backend/src/services/uploads.js`

### Agent handlers

- `backend/src/handlers/agents/create-agent.js`
- `backend/src/handlers/agents/list-agents.js`
- `backend/src/handlers/agents/get-agent.js`
- `backend/src/handlers/agents/update-agent.js`
- `backend/src/handlers/agents/delete-agent.js`

### Message handlers

- `backend/src/handlers/messages/create-message.js`
- `backend/src/handlers/messages/list-messages.js`

### Upload handlers

- `backend/src/handlers/uploads/create-upload.js`

## Deploy steps

```bash
cd backend
npm install
sam build
sam deploy
```

## Free-tier notes

This Phase 2 backend stays within the same AWS free-tier friendly architecture:

- Lambda for compute
- API Gateway for APIs
- DynamoDB with `PAY_PER_REQUEST`
- S3 with pre-signed uploads for direct browser-to-storage transfer

This is a good low-cost setup for early usage, testing, and iteration.
Still monitor AWS billing regularly because “free-tier friendly” does not mean unlimited usage forever.

## LLM wrapper note

Right now Phase 2 stores:

- persona configuration
- full chat history

That means later you can cleanly plug in an AI response layer such as:

- self-hosted / external Llama wrapper
- Gemini API
- Amazon Bedrock

without redesigning the data model again.

## AI orchestration note

The current architecture now also supports:

- dynamic model-provider selection at the persona level
- Gemini as the active provider
- future wrappers for OpenRouter and Llama
- lightweight memory recall based on recent messages and text similarity
- memory chunk creation after repeated conversation turns
