export type CloudinaryRef = {
  publicId: string;
  secureUrl: string;
};

export function toCloudinaryRef(value: unknown): CloudinaryRef {
  if (!value || typeof value !== "object") {
    throw new Error("Cloudinary upload failed: invalid response");
  }

  const maybe = value as { publicId?: unknown; secureUrl?: unknown };
  if (typeof maybe.publicId !== "string" || maybe.publicId.length === 0) {
    throw new Error("Cloudinary upload failed: missing publicId");
  }
  if (typeof maybe.secureUrl !== "string" || maybe.secureUrl.length === 0) {
    throw new Error("Cloudinary upload failed: missing secureUrl");
  }

  return { publicId: maybe.publicId, secureUrl: maybe.secureUrl };
}
