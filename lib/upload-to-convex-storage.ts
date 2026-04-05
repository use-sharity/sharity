import type { Id } from "@/convex/_generated/dataModel";

export async function uploadFileToConvexStorage(args: {
  file: File;
  generateUploadUrl: () => Promise<string>;
}): Promise<Id<"_storage">> {
  const uploadUrl = await args.generateUploadUrl();
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": args.file.type },
    body: args.file,
  });

  if (!result.ok) {
    throw new Error(`Upload failed for ${args.file.name}`);
  }

  const data = (await result.json()) as { storageId?: Id<"_storage"> };
  if (!data.storageId) {
    throw new Error(`Upload response missing storageId for ${args.file.name}`);
  }

  return data.storageId;
}
