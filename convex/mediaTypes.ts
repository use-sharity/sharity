import { v } from "convex/values";

export const vCloudinaryRef = v.object({
  publicId: v.string(),
  secureUrl: v.string(),
});

export type CloudinaryRef = {
  publicId: string;
  secureUrl: string;
};
