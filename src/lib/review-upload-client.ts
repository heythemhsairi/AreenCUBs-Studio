"use client";

import { type ReviewUploadTicket, validateReviewVideo } from "@/lib/review-upload";
import { createClient } from "@/lib/supabase/client";

export async function uploadReviewVideoToTicket(
  ticket: ReviewUploadTicket,
  file: File,
): Promise<string | null> {
  const validationError = validateReviewVideo(file.type, file.size);
  if (validationError) return validationError;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("review-media")
    .uploadToSignedUrl(ticket.storagePath, ticket.token, file, {
      contentType: file.type,
      cacheControl: "3600",
    });
  return error?.message ?? null;
}

export function appendReviewFileMetadata(formData: FormData, file: File) {
  formData.set("mime", file.type);
  formData.set("size_bytes", String(file.size));
}
