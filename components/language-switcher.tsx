"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const updateLocale = useMutation(api.users.updateLocale);

  function onSelectChange(nextLocale: string) {
    router.replace(pathname, { locale: nextLocale });
    if (isAuthenticated) {
      updateLocale({
        locale: nextLocale as "en" | "vi" | "ru",
      }).catch(console.error);
    }
  }

  return (
    <Select value={locale} onValueChange={onSelectChange}>
      <SelectTrigger className="w-fit gap-2 border-none shadow-none bg-transparent focus:ring-0 px-1 sm:px-2 lg:px-3 focus:ring-offset-0 sm:[&>svg:last-child]:block [&>svg:last-child]:hidden">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline text-sm font-medium">
          {locale.toUpperCase()}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="vi">Tiếng Việt</SelectItem>
        <SelectItem value="ru">Русский</SelectItem>
      </SelectContent>
    </Select>
  );
}
