"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { renderToString } from "react-dom/server";
import { useTranslations } from "next-intl";

// Da Lat coordinates
const DEFAULT_CENTER: [number, number] = [11.9404, 108.4583];
const DEFAULT_ZOOM = 13;

export interface LocationPickerValue {
  lat: number;
  lng: number;
  address?: string;
  ward?: string; // Public display name (district/ward)
}

interface LocationPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: LocationPickerValue;
  onSelect: (location: LocationPickerValue) => void;
}

interface GeocodeResult {
  address: string;
  ward: string;
}

// Extract ward/district from Nominatim address response
function extractWard(addressData: Record<string, string> | undefined): string {
  if (!addressData) return "Unknown area";

  // Try different fields that represent ward/district in Nominatim
  // Priority: suburb > quarter > neighbourhood > city_district > town > city
  const ward =
    addressData.suburb ||
    addressData.quarter ||
    addressData.neighbourhood ||
    addressData.city_district ||
    addressData.town ||
    addressData.city ||
    addressData.county;

  return ward || "Unknown area";
}

// Reverse geocode using Nominatim API
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Sharity App",
        },
      },
    );
    if (!response.ok) throw new Error("Geocoding failed");
    const data = await response.json();

    // Full address for owner's private use
    const address =
      data.display_name?.split(",").slice(0, 3).join(",").trim() ||
      "Unknown location";

    // Ward/district for public display
    const ward = extractWard(data.address);

    return { address, ward };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return { address: "Unknown location", ward: "Unknown area" };
  }
}

// Round coordinates for privacy (~111m precision)
function roundCoordinate(coord: number): number {
  return Math.round(coord * 1000) / 1000;
}

// Create a custom marker icon for the location picker
function createLocationMarkerIcon(L: typeof import("leaflet")) {
  const iconHtml = renderToString(
    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-white shadow-lg">
      <MapPin className="w-5 h-5 text-emerald-500" />
    </div>,
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

export function LocationPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: LocationPickerDialogProps) {
  const t = useTranslations("LocationPicker");
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    useMapEvents: typeof import("react-leaflet").useMapEvents;
    useMap: typeof import("react-leaflet").useMap;
    L: typeof import("leaflet");
  } | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(value ? { lat: value.lat, lng: value.lng } : null);
  const [address, setAddress] = useState<string>(value?.address || "");
  const [ward, setWard] = useState<string>(value?.ward || "");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Dynamic import for SSR compatibility
  useEffect(() => {
    if (open && !MapComponents) {
      Promise.all([import("react-leaflet"), import("leaflet")]).then(
        ([reactLeaflet, L]) => {
          setMapComponents({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            Marker: reactLeaflet.Marker,
            useMapEvents: reactLeaflet.useMapEvents,
            useMap: reactLeaflet.useMap,
            L: L,
          });
        },
      );
    }
  }, [open, MapComponents]);

  // Reset state when dialog opens with a value
  useEffect(() => {
    if (open) {
      setSelectedLocation(value ? { lat: value.lat, lng: value.lng } : null);
      setAddress(value?.address || "");
      setWard(value?.ward || "");
    }
  }, [open, value]);

  const handleLocationChange = useCallback(async (lat: number, lng: number) => {
    const roundedLat = roundCoordinate(lat);
    const roundedLng = roundCoordinate(lng);
    setSelectedLocation({ lat: roundedLat, lng: roundedLng });

    // Reverse geocode
    setIsGeocoding(true);
    const result = await reverseGeocode(roundedLat, roundedLng);
    setAddress(result.address);
    setWard(result.ward);
    setIsGeocoding(false);
  }, []);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t("geolocationNotSupported"));
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationChange(
          position.coords.latitude,
          position.coords.longitude,
        );
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        toast.error(t("locationError", { error: error.message }));
      },
    );
  }, [handleLocationChange, t]);

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect({
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        address: address || undefined,
        ward: ward || undefined,
      });
      onOpenChange(false);
    }
  };

  // Inner component for map click handling
  function MapClickHandler({
    onLocationSelect,
  }: {
    onLocationSelect: (lat: number, lng: number) => void;
  }) {
    MapComponents!.useMapEvents({
      click: (e) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  // Component to recenter map when location changes
  function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = MapComponents!.useMap();
    useEffect(() => {
      map.setView([lat, lng], map.getZoom());
    }, [map, lat, lng]);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Map */}
          <div className="w-full h-[350px] rounded-lg overflow-hidden border bg-gray-100">
            {!MapComponents ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MapComponents.MapContainer
                center={
                  selectedLocation
                    ? [selectedLocation.lat, selectedLocation.lng]
                    : DEFAULT_CENTER
                }
                zoom={DEFAULT_ZOOM}
                className="w-full h-full"
              >
                <MapComponents.TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={handleLocationChange} />
                {selectedLocation && (
                  <>
                    <MapRecenter
                      lat={selectedLocation.lat}
                      lng={selectedLocation.lng}
                    />
                    <MapComponents.Marker
                      position={[selectedLocation.lat, selectedLocation.lng]}
                      draggable={true}
                      icon={createLocationMarkerIcon(MapComponents.L)}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          handleLocationChange(pos.lat, pos.lng);
                        },
                      }}
                    />
                  </>
                )}
              </MapComponents.MapContainer>
            )}
          </div>

          {/* Location info */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGetCurrentLocation}
              disabled={isGettingLocation}
              className="shrink-0"
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              {t("useCurrent")}
            </Button>
          </div>

          {/* Address display */}
          {selectedLocation && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1 min-w-0">
                {isGeocoding ? (
                  <span className="text-sm text-muted-foreground">
                    {t("loadingAddress")}
                  </span>
                ) : (
                  <>
                    <span className="text-sm break-words">{address}</span>
                    {ward && (
                      <span className="text-xs text-muted-foreground">
                        {t("area", { ward })}
                      </span>
                    )}
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {selectedLocation.lat.toFixed(4)},{" "}
                  {selectedLocation.lng.toFixed(4)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLocation}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
