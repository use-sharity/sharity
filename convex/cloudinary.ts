import { makeCloudinaryAPI } from "@imaxis/cloudinary-convex";
import { components } from "./_generated/api";

export const {
  upload,
  transform,
  deleteAsset,
  listAssets,
  getAsset,
  updateAsset,
  generateUploadCredentials,
  finalizeUpload,
  createPendingUpload,
  updateUploadStatus,
  getUploadsByStatus,
  deletePendingUpload,
} = makeCloudinaryAPI(components.cloudinary);
