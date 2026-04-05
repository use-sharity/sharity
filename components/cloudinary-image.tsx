"use client";

import Image, { type ImageLoader } from "next/image";

import { cn } from "@/lib/utils";

const CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/";

export function isCloudinaryImageUrl(url: string): boolean {
  return (
    url.includes("res.cloudinary.com") &&
    url.includes(CLOUDINARY_UPLOAD_SEGMENT)
  );
}

const cloudinaryLoader: ImageLoader = ({ src, width }) => {
  if (!isCloudinaryImageUrl(src)) {
    throw new Error(`CloudinaryImage received non-Cloudinary src: ${src}`);
  }

  const transform = `f_auto,q_auto:good,dpr_auto,c_limit,w_${width}`;
  return src.replace(
    CLOUDINARY_UPLOAD_SEGMENT,
    `${CLOUDINARY_UPLOAD_SEGMENT}${transform}/`,
  );
};

type CloudinaryImageProps =
  | {
      src: string;
      alt: string;
      className?: string;
      sizes: string;
      priority?: boolean;
      fill: true;
      width?: never;
      height?: never;
    }
  | {
      src: string;
      alt: string;
      className?: string;
      sizes: string;
      priority?: boolean;
      fill?: false;
      width: number;
      height: number;
    };

export function CloudinaryImage(props: CloudinaryImageProps) {
  if (!isCloudinaryImageUrl(props.src)) {
    throw new Error(
      `CloudinaryImage received non-Cloudinary src: ${props.src}`,
    );
  }

  const { src, alt, className, sizes, priority } = props;

  if (props.fill) {
    return (
      <Image
        loader={cloudinaryLoader}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <Image
      loader={cloudinaryLoader}
      src={src}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
