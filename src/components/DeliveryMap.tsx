'use client';
import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import { MapPin, Navigation, Store, Box, Square } from 'lucide-react';
import { LngLatBounds } from 'maplibre-gl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Estilo vetorial gratuito que suporta 3D
const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/bright';

export type MapStop = {
  lng: number;
  lat: number;
  label: string;
  type: 'pickup' | 'dropoff';
  id: string;
};

interface DeliveryMapProps {
  stops?: MapStop[];
  currentLocation?: { lng: number; lat: number; heading?: number | null } | null;
  enable3D?: boolean;
}

export default function DeliveryMap({ stops = [], currentLocation, enable3D = true }: DeliveryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [primaryColor, setPrimaryColor] = useState<string>('#3B82F6');
  const [routeGeoJson, setRouteGeoJson] = useState<any>(null);
  const [is3DActive, setIs3DActive] = useState(enable3D);
  const lastPointsRef = useRef<string>('');

  // Padrão Arapongas, PR
  const defaultLng = -51.4236;
  const defaultLat = -23.4128;

  const [viewState, setViewState] = useState({
    longitude: defaultLng,
    latitude: defaultLat,
    zoom: 13,
    pitch: enable3D ? 65 : 0,
    bearing: 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hslValue = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (hslValue && !hslValue.includes('var')) {
        setPrimaryColor(`hsl(${hslValue})`);
      }
    }
  }, []);

  // Ajuste inicial para mostrar todos os pontos
  useEffect(() => {
    if (!mapRef.current || stops.length === 0) return;

    const bounds = new LngLatBounds();
    let hasPoints = false;

    stops.forEach(stop => {
      bounds.extend([stop.lng, stop.lat]);
      hasPoints = true;
    });

    if (currentLocation) {
      bounds.extend([currentLocation.lng, currentLocation.lat]);
      hasPoints = true;
    }

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, { padding: 60, duration: 1000, maxZoom: 15 });
    }
  }, [stops.length]);

  // Lógica de SEGUIR e ROTACIONAR (Estilo Navegador GPS)
  useEffect(() => {
    if (!currentLocation || !mapRef.current) return;

    const map = mapRef.current.getMap();
    
    map.easeTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: is3DActive ? 17.5 : 16,
      pitch: is3DActive ? 65 : 0,
      bearing: currentLocation.heading || viewState.bearing || 0,
      duration: 2000,
      essential: true
    });
  }, [currentLocation?.lng, currentLocation?.lat, currentLocation?.heading, is3DActive]);

  // Cálculo de Rota OSRM
  useEffect(() => {
    const fetchRoute = async () => {
      if (stops.length < 1) {
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

  const togglePerspective = () => {
    const next3D = !is3DActive;
    setIs3DActive(next3D);
    
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      map.easeTo({
        pitch: next3D ? 65 : 0,
        zoom: next3D ? 17.5 : 16,
        duration: 1000
      });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle={VECTOR_STYLE}
        attributionControl={false}
        antialias={true}
      >
        {/* Camada de Prédios 3D */}
        <Layer
          id="3d-buildings"
          type="fill-extrusion"
          source="openmaptiles"
          source-layer="building"
          minzoom={15}
          paint={{
            'fill-extrusion-color': '#eee',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.05, ['get', 'render_height']
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              15, 0,
              15.05, ['get', 'render_base_height']
            ],
            'fill-extrusion-opacity': is3DActive ? 0.6 : 0
          }}
        />

        {currentLocation && (
          <Marker longitude={currentLocation.lng} latitude={currentLocation.lat} anchor="center">
            <div className="relative" style={{ transform: `rotate(${currentLocation.heading || 0}deg)` }}>
              <div className="absolute -inset-4 bg-primary/20 rounded-full animate-pulse" />
              <div className="relative size-10 bg-primary rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
                <Navigation className="size-5 text-white" fill="white" />
              </div>
            </div>
          </Marker>
        )}

        {stops?.map((stop, index) => (
          <Marker key={`${stop.id}-${index}`} longitude={stop.lng} latitude={stop.lat} anchor="bottom">
            <div className="flex flex-col items-center group cursor-pointer">
              <div className="bg-white px-2 py-1 rounded-md shadow-md text-[10px] font-bold mb-1 border whitespace-nowrap">
                {stop.label}
              </div>
              {stop.type === 'pickup' ? (
                <div className="bg-primary p-2 rounded-full shadow-lg border-2 border-white">
                  <Store className="size-5 text-white" />
                </div>
              ) : (
                <div className="bg-red-500 p-2 rounded-full shadow-lg border-2 border-white">
                  <MapPin className="size-5 text-white" />
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
                'line-width': 6,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}
      </Map>

      {/* Botão de Alternância de Perspectiva - Localizado no canto inferior direito */}
      <div className="absolute bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-auto">
        <Button
          size="icon"
          variant="secondary"
          className={cn(
            "size-14 rounded-2xl shadow-2xl border-2 transition-all active:scale-90",
            is3DActive ? "bg-primary text-white border-primary/20" : "bg-white text-primary border-muted"
          )}
          onClick={(e) => {
            e.stopPropagation();
            togglePerspective();
          }}
        >
          {is3DActive ? <Box size={28} /> : <Square size={28} />}
          <span className="sr-only">Alternar Perspectiva</span>
        </Button>
      </div>
    </div>
  );
}
