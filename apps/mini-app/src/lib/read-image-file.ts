const MAX_BYTES = 2_000_000;

/**
 * Read a user-picked image as a data-URL for the game-cover upload API.
 * Rejects non-images and files over 2 MB (matches the API limit).
 */
export function readImageAsDataUrl(file: File): Promise<{ base64: string; mime: string }> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Only JPEG, PNG, or WebP images are allowed'));
  }
  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error('Image must be under 2 MB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      if (!result) {
        reject(new Error('Empty image'));
        return;
      }
      resolve({ base64: result, mime: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}
