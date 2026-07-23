import { apiFetch, getStoredToken, clearStoredToken, ApiError } from '@/src/utils/apiFetch';

interface CreateUploadRequest {
  fileName: string;
  fileType: string;
}

interface CreateUploadResponse {
  uploadUrl: string;
  fileId: string;
  fileUrl: string;
  fileViewUrl: string;
}

export async function createUploadSession(payload: CreateUploadRequest) {
  return apiFetch<CreateUploadResponse>('/upload', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(`S3 upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading file'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload was cancelled'));
    };

    xhr.send(file);
  });
}

export function ensureAuthenticatedUpload() {
  const token = getStoredToken();

  if (!token) {
    clearStoredToken();
    throw new ApiError('Your session expired. Please log in again.', 401);
  }

  return token;
}
