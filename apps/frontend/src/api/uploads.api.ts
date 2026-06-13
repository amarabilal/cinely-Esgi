import client from './client';

export interface UploadResult {
  id: string;
  url: string;
}

export const uploadsApi = {
  /**
   * Upload a single image file. The backend stores it and returns an absolute,
   * publicly-readable URL (`https://cinely.fr/api/uploads/<uuid>`) suitable as an
   * <img src> on web, native, and for collaborators (it survives in stored note
   * HTML and syncs over the socket).
   *
   * Axios derives the multipart boundary from the FormData body automatically —
   * do NOT set Content-Type manually.
   */
  upload(file: File | Blob) {
    const form = new FormData();
    form.append('file', file);
    return client.post<UploadResult>('/uploads', form);
  },
};
