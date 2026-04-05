"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Doc } from "../convex/_generated/dataModel";
import { type ItemCategory } from "@/lib/constants";
import { createMarkerIcon } from "./item-marker";
import { useTranslations } from "next-intl";
import {
  CloudinaryImage,
  isCloudinaryImageUrl,
} from "@/components/cloudinary-image";

// Da Lat coordinates
const DEFAULT_CENTER: [number, number] = [11.9404, 108.4583];
const DEFAULT_ZOOM = 13;

// Privacy: small stable offset (~50-100m) based on item ID
const PRIVACY_OFFSET = 0.0008; // ~80m

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

function getPrivacyOffset(itemId: string): [number, number] {
  const hash1 = hashString(itemId + "_lat");
  const hash2 = hashString(itemId + "_lng");
  const latOffset = ((hash1 % 1000) / 500 - 1) * PRIVACY_OFFSET;
  const lngOffset = ((hash2 % 1000) / 500 - 1) * PRIVACY_OFFSET;
  return [latOffset, lngOffset];
}

// Component to fix Leaflet tile loading issue
function InvalidateSize() {
  const [useMapHook, setUseMapHook] = useState<
    typeof import("react-leaflet").useMap | null
  >(null);

  useEffect(() => {
    import("react-leaflet").then((mod) => {
      setUseMapHook(() => mod.useMap);
    });
  }, []);

  if (!useMapHook) return null;

  return <InvalidateSizeInner useMap={useMapHook} />;
}

function InvalidateSizeInner({
  useMap,
}: {
  useMap: typeof import("react-leaflet").useMap;
}) {
  const map = useMap();

  useEffect(() => {
    // Fix tiles not loading properly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Also invalidate on window resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  return null;
}

interface ItemsMapProps {
  items: (Doc<"items"> & {
    imageUrls?: string[];
    category?: ItemCategory;
    location?: { lat: number; lng: number; address?: string; ward?: string };
  })[];
  onItemClick?: (id: string) => void;
}

export function ItemsMap({ items, onItemClick }: ItemsMapProps) {
  const tCategories = useTranslations("Categories");
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    L: typeof import("leaflet");
  } | null>(null);

  useEffect(() => {
    // Dynamic import for SSR compatibility
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([reactLeaflet, L]) => {
        setMapComponents({
          MapContainer: reactLeaflet.MapContainer,
          TileLayer: reactLeaflet.TileLayer,
          Marker: reactLeaflet.Marker,
          Popup: reactLeaflet.Popup,
          L: L,
        });
      },
    );
  }, []);

  const itemsWithLocation = items.filter((item) => item.location);

  if (!MapComponents) {
    return (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden border">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <InvalidateSize />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {itemsWithLocation.map((item) => {
          const [latOffset, lngOffset] = getPrivacyOffset(item._id);
          return (
            <Marker
              key={item._id}
              position={[
                item.location!.lat + latOffset,
                item.location!.lng + lngOffset,
              ]}
              icon={createMarkerIcon({
                category: item.category,
                L: MapComponents.L,
              })}
              eventHandlers={{
                click: () => onItemClick?.(item._id),
              }}
            >
              <Popup>
                <div className="min-w-[150px]">
                  {item.imageUrls &&
                    item.imageUrls[0] &&
                    isCloudinaryImageUrl(item.imageUrls[0]) && (
                      <div className="relative w-full h-20 rounded mb-2 overflow-hidden bg-gray-100">
                        <CloudinaryImage
                          src={item.imageUrls[0]}
                          alt={item.name}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />
                      </div>
                    )}
                  <Link
                    href={`/item/${item._id}`}
                    className="font-semibold text-sm hover:underline"
                  >
                    {item.name}
                  </Link>
                  {item.category && (
                    <p className="text-xs text-muted-foreground">
                      {tCategories(item.category)}
                    </p>
                  )}
                  {item.location?.ward && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Area: {item.location.ward}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
