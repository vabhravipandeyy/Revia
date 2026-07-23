const { badRequest, created, internalServerError, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { createUploadSession } = require('../../services/uploads');

async function createUploadHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const requestId = event?.requestContext?.requestId || 'unknown';
    const body = parseJsonBody(event);
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : '';

    console.log('Create upload request received', {
      requestId,
      userId,
      fileName,
      fileType,
    });

    if (!fileName) {
      return badRequest('fileName is required');
    }

    if (!fileType) {
      return badRequest('fileType is required');
    }

    const uploadSession = await createUploadSession({
      userId,
      fileName,
      fileType,
    });

    console.log('Create upload request succeeded', {
      requestId,
      userId,
      fileId: uploadSession.fileId,
    });

    return created(uploadSession);
  } catch (error) {
    console.error('Create upload error', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'UnsupportedFileTypeError') {
      return badRequest(error.message);
    }

    if (error.message === 'File name is required' || error.message === 'File type is required') {
      return badRequest(error.message);
    }

    return internalServerError('Failed to prepare upload');
  }
}

exports.handler = withAuth(createUploadHandler);
