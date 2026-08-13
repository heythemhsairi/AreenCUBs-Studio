import { describe, expect, it } from "vitest";
import {
  MAX_REVIEW_VIDEO_BYTES,
  reviewStoragePath,
  validateReviewVideo,
} from "./review-upload";

describe("review video uploads", () => {
  it("accepts the supported video formats through the 200 MB boundary", () => {
    expect(validateReviewVideo("video/mp4", MAX_REVIEW_VIDEO_BYTES)).toBeNull();
    expect(validateReviewVideo("video/webm", 1)).toBeNull();
    expect(validateReviewVideo("video/quicktime", 1)).toBeNull();
    expect(validateReviewVideo("video/x-matroska", 1)).toBeNull();
  });

  it("rejects empty, oversized, and unsupported files", () => {
    expect(validateReviewVideo("video/mp4", 0)).toMatch(/Choisissez/);
    expect(validateReviewVideo("video/mp4", MAX_REVIEW_VIDEO_BYTES + 1)).toMatch(/200 Mo/);
    expect(validateReviewVideo("text/plain", 100)).toMatch(/Format non pris en charge/);
  });

  it("builds the client-scoped immutable storage path", () => {
    expect(reviewStoragePath("client", "asset", 3, "video/quicktime")).toBe(
      "client/asset/v3.mov",
    );
    expect(reviewStoragePath("client", "asset", 0, "video/mp4")).toBeNull();
    expect(reviewStoragePath("client", "asset", 1, "video/avi")).toBeNull();
  });
});
