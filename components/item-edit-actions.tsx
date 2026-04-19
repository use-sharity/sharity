"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ItemForm } from "@/components/item-form";
import type { MediaImage } from "@/components/item-form";

interface ItemEditActionsProps {
  item: Doc<"items"> & { images?: MediaImage[] };
}

export function ItemEditActions({ item }: ItemEditActionsProps) {
  const t = useTranslations("MyItemCard");
  const updateItem = useMutation(api.items.update);
  const switchItemMode = useMutation(api.items.switchItemMode);
  const deleteItem = useMutation(api.items.deleteItem);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            {t("edit")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <ItemForm
            initialValues={{
              name: item.name,
              description: item.description || "",
              images: item.images,
              giveaway: Boolean(item.giveaway),
            }}
            enableModeSwitch
            hideMyItemsLink
            onSubmit={async (values) => {
              if (
                typeof values.giveaway === "boolean" &&
                values.giveaway !== Boolean(item.giveaway)
              ) {
                await switchItemMode({
                  id: item._id,
                  giveaway: values.giveaway,
                });
              }
              await updateItem({
                id: item._id,
                name: values.name,
                description: values.description,
                imageCloudinary: values.imageCloudinary,
              });
              setEditOpen(false);
            }}
            submitLabel={t("saveChanges")}
            footerActions={
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {t("cancel")}
                </Button>
              </DialogClose>
            }
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItem({ id: item._id })}>
              {t("deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
