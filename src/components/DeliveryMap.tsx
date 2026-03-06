
'use client';
import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import { MapPin, Navigation, Store } from 'lucide-react';
import { LngLatBounds } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';

// Usando tiles raster do OSM para economia total (gratuito e sem chave de API)
const osmRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export type MapStop = {
  lng: number;
  lat: number;
  label: string;
  type: 'pickup' | 'dropoff';
  id: string;
};

interface DeliveryMapProps {
  stops?: MapStop[];
  currentLocation?: { lng: number; lat: number } | null;
}

export default function DeliveryMap({ stops = [], currentLocation }: DeliveryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const lastPointsRef = useRef<string>('');
  
  // Padrão Arapongas, PR
  const defaultLng = -51.4236;
  const defaultLat = -23.4128;

  const [viewState, setViewState] = useState({
    longitude: currentLocation?.lng || stops?.[0]?.lng || defaultLng,
    latitude: currentLocation?.lat || stops?.[0]?.lat || defaultLat,
    zoom: 13,
  });
  
  const [routeGeoJson, setRouteGeoJson] = useState<any>(null);
  const [primaryColor, setPrimaryColor] = useState<string>('#3B82F6');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hslValue = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (hslValue && !hslValue.includes('var')) {
        setPrimaryColor(`hsl(${hslValue})`);
      }
    }
  }, []);

  // Efeito para ajustar o mapa quando a localização atual ou as paradas mudarem
  useEffect(() => {
    if (!mapRef.current) return;

    const bounds = new LngLatBounds();
    let hasPoints = false;

    if (currentLocation) {
      bounds.extend([currentLocation.lng, currentLocation.lat]);
      hasPoints = true;
    }

    stops.forEach(stop => {
      bounds.extend([stop.lng, stop.lat]);
      hasPoints = true;
    });

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, { padding: 60, duration: 1000, maxZoom: 15 });
    }
  }, [currentLocation, stops]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!stops || stops.length < 1) {
        setRouteGeoJson(null);
        return;
      }
      
      const points = [];
      if (currentLocation) {
        points.push(`${currentLocation.lng},${currentLocation.lat}`);
      }
      stops.forEach(s => points.push(`${s.lng},${s.lat}`));

      const pointsKey = points.join(';');
      if (pointsKey === lastPointsRef.current) return;
      lastPointsRef.current = pointsKey;
      
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pointsKey}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          setRouteGeoJson({
            type: 'Feature',
            geometry: data.routes[0].geometry,
          });
        }
      } catch (e) {
        console.error("Erro ao carregar rota OSRM:", e);
      }
    };

    fetchRoute();
  }, [stops, currentLocation]);

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={osmRasterStyle}
      attributionControl={false}
    >
      {currentLocation && (
        <Marker longitude={currentLocation.lng} latitude={currentLocation.lat} anchor="center">
          <div className="relative">
            <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
            <div className="relative size-7 bg-primary rounded-full border-4 border-white shadow-xl flex items-center justify-center">
              <Navigation className="size-3.5 text-white -rotate-45" fill="white" />
            </div>
          </div>
        </Marker>
      )}

      {stops?.map((stop, index) => (
        <Marker key={`${stop.id}-${index}`} longitude={stop.lng} latitude={stop.lat} anchor="bottom">
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="bg-white px-2 py-1 rounded-md shadow-md text-[10px] font-bold mb-1 border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {stop.label}
            </div>
            {stop.type === 'pickup' ? (
              <div className="bg-primary p-1.5 rounded-full shadow-lg border-2 border-white">
                <Store className="size-4 text-white" />
              </div>
            ) : (
              <div className="bg-red-500 p-1.5 rounded-full shadow-lg border-2 border-white">
                <MapPin className="size-4 text-white" />
              </div>
            )}
          </div>
        </Marker>
      ))}

      {routeGeoJson && (
        <Source id="route" type="geojson" data={routeGeoJson}>
          <Layer
            id="route"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': primaryColor,
              'line-width': 5,
              'line-opacity': 0.6
            }}
          />
        </Source>
      )}
    </Map>
  );
}
