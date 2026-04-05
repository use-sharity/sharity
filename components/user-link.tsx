"use client";

import { useQuery } from "convex/react";
import { User } from "lucide-react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { CloudinaryImage } from "@/components/cloudinary-image";

interface UserLinkProps {
  userId: string;
  size?: "sm" | "md" | "lg";
  showAvatar?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    avatar: "h-5 w-5",
    icon: "h-3 w-3",
    text: "text-sm",
  },
  md: {
    avatar: "h-6 w-6",
    icon: "h-3.5 w-3.5",
    text: "text-sm",
  },
  lg: {
    avatar: "h-8 w-8",
    icon: "h-4 w-4",
    text: "text-base",
  },
};

export function UserLink({
  userId,
  size = "md",
  showAvatar = true,
  className,
}: UserLinkProps) {
  const userInfo = useQuery(api.users.getBasicInfo, { userId });
  const styles = sizeStyles[size];

  if (userInfo === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 animate-pulse",
          className,
        )}
      >
        {showAvatar && (
          <span className={cn("rounded-full bg-gray-200", styles.avatar)} />
        )}
        <span className={cn("bg-gray-200 rounded w-20 h-4", styles.text)} />
      </span>
    );
  }

  const displayName = userInfo.name || "Anonymous";

  return (
    <Link
      href={`/user/${userId}`}
      className={cn(
        "inline-flex items-center gap-1.5 hover:underline font-medium",
        styles.text,
        className,
      )}
    >
      {showAvatar && (
        <span
          className={cn(
            "rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center",
            styles.avatar,
          )}
        >
          {userInfo.avatarUrl ? (
            <div className="relative h-full w-full">
              <CloudinaryImage
                src={userInfo.avatarUrl}
                alt={displayName}
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
          ) : (
            <User className={cn("text-gray-400", styles.icon)} />
          )}
        </span>
      )}
      <span className="truncate">{displayName}</span>
    </Link>
  );
}
