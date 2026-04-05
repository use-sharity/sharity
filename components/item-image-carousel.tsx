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
  if (validUrls.length === 0) return null;

  return (
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
              <div
                className={cn(
                  "w-full relative",
                  aspectRatio === "video" ? "aspect-video" : "aspect-4/3",
                )}
              >
                <CloudinaryImage
                  src={url}
                  alt={`${name} - Image ${index + 1}`}
                  fill
                  sizes={sizes}
                  className="object-cover"
                />
              </div>
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
  );
}
