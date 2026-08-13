export const MAX_REVIEW_VIDEO_BYTES = 200 * 1024 * 1024;

export const REVIEW_VIDEO_EXTENSIONS: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
};

export type ReviewUploadTicket = {
  assetId: string;
  storagePath: string;
  token: string;
  versionNumber: number;
};

export function validateReviewVideo(mime: string, sizeBytes: number): string | null {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return "Choisissez la vidéo à envoyer.";
  }
  if (!(mime in REVIEW_VIDEO_EXTENSIONS)) {
    return "Format non pris en charge. Utilisez MP4, WebM, MOV ou MKV.";
  }
  if (sizeBytes > MAX_REVIEW_VIDEO_BYTES) {
    return "Vidéo trop grande (200 Mo maximum).";
  }
  return null;
}

export function reviewStoragePath(
  clientId: string,
  assetId: string,
  versionNumber: number,
  mime: string,
): string | null {
  const extension = REVIEW_VIDEO_EXTENSIONS[mime];
  if (!extension || !Number.isSafeInteger(versionNumber) || versionNumber <= 0) {
    return null;
  }
  return `${clientId}/${assetId}/v${versionNumber}.${extension}`;
}
