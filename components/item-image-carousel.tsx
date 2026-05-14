"use client";

import { useState, useCallback } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  CloudinaryImage,
  isCloudinaryImageUrl,
} from "@/components/cloudinary-image";
import { cn } from "@/lib/utils";

interface ItemImageCarouselProps {
  imageUrls: string[];
  name: string;
  aspectRatio?: "video" | "4/3";
  sizes?: string;
  className?: string;
}

export function ItemImageCarousel({
  imageUrls,
  name,
  aspectRatio = "video",
  sizes = "(max-width: 768px) 100vw, 672px",
  className,
}: ItemImageCarouselProps) {
  const validUrls = imageUrls.filter(isCloudinaryImageUrl);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const openLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
    },
    [setLightboxIndex],
  );

  if (validUrls.length === 0) return null;

  const slides = validUrls.map((url) => ({ src: url }));

  return (
    <>
      <div
        className={cn(
          "w-full relative rounded-md overflow-hidden bg-gray-100",
          aspectRatio === "video" ? "aspect-video" : "aspect-4/3",
          className,
        )}
      >
        <Carousel className="w-full h-full">
          <CarouselContent>
            {validUrls.map((url, index) => (
              <CarouselItem key={index}>
                <button
                  type="button"
                  className={cn(
                    "w-full relative cursor-zoom-in",
                    aspectRatio === "video" ? "aspect-video" : "aspect-4/3",
                  )}
                  onClick={() => openLightbox(index)}
                >
                  <CloudinaryImage
                    src={url}
                    alt={`${name} - Image ${index + 1}`}
                    fill
                    sizes={sizes}
                    className="object-cover"
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
          {validUrls.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>
      </div>

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={slides}
        carousel={{ finite: true }}
        render={
          slides.length <= 1
            ? {
                buttonPrev: () => null,
                buttonNext: () => null,
              }
            : undefined
        }
      />
    </>
  );
}
