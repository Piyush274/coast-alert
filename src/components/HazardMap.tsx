import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import { HazardReport } from '@/types/hazard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  MapPin, 
  Eye, 
  Clock, 
  User,
  Waves,
  Wind,
  Zap,
  Shield,
  Search,
  Navigation,
  Target,
  Thermometer
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface HazardMapProps {
  reports: HazardReport[];
  height?: string;
  className?: string;
}

interface Hotspot {
  lat: number;
  lng: number;
  intensity: number;
  radius: number;
  reportCount: number;
}

interface SearchResult {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

// Custom marker icons based on hazard type and severity
const createCustomIcon = (hazardType: string, severity: string) => {
  const getIconColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626'; // red-600
      case 'high': return '#ea580c'; // orange-600
      case 'medium': return '#d97706'; // amber-600
      case 'low': return '#16a34a'; // green-600
      default: return '#6b7280'; // gray-500
    }
  };

  const getIconSymbol = (hazardType: string) => {
    switch (hazardType.toLowerCase()) {
      case 'tsunami': return '🌊';
      case 'storm surge': return '💨';
      case 'high waves': return '🌊';
      case 'flooding': return '💧';
      case 'coastal erosion': return '🏖️';
      case 'abnormal tide': return '🌊';
      default: return '⚠️';
    }
  };

  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="${getIconColor(severity)}" stroke="white" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-size="16" fill="white">${getIconSymbol(hazardType)}</text>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to fit map bounds to show all markers
const FitBounds = ({ reports }: { reports: HazardReport[] }) => {
  const map = useMap();

  useEffect(() => {
    if (reports.length > 0) {
      const bounds = reports.map(report => [report.location.lat, report.location.lng] as [number, number]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [reports, map]);

  return null;
};

const HazardMap: React.FC<HazardMapProps> = ({ 
  reports, 
  height = "400px", 
  className = "" 
}) => {
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showCurrentLocation, setShowCurrentLocation] = useState(false);
  const mapRef = useRef<any>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified": return "bg-green-500 text-white";
      case "pending": return "bg-yellow-500 text-white";
      case "rejected": return "bg-red-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setShowCurrentLocation(true);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  // Search for locations using Nominatim (OpenStreetMap)
  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`
      );
      const results = await response.json();
      
      const searchResults: SearchResult[] = results.map((result: any) => ({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        name: result.display_name.split(',')[0],
        address: result.display_name
      }));
      
      setSearchResults(searchResults);
    } catch (error) {
      console.error('Error searching location:', error);
    }
  };

  // Calculate hotspots based on report density
  const calculateHotspots = () => {
    if (reports.length === 0) return;

    const hotspots: Hotspot[] = [];
    const gridSize = 0.1; // Grid size in degrees
    const minReports = 2; // Minimum reports to form a hotspot

    // Create a grid and count reports in each cell
    const grid: { [key: string]: { lat: number, lng: number, reports: HazardReport[] } } = {};
    
    reports.forEach(report => {
      const gridLat = Math.floor(report.location.lat / gridSize) * gridSize;
      const gridLng = Math.floor(report.location.lng / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;
      
      if (!grid[key]) {
        grid[key] = { lat: gridLat + gridSize/2, lng: gridLng + gridSize/2, reports: [] };
      }
      grid[key].reports.push(report);
    });

    // Create hotspots for cells with enough reports
    Object.values(grid).forEach(cell => {
      if (cell.reports.length >= minReports) {
        const severity = cell.reports.some(r => r.severity === 'critical') ? 'critical' :
                        cell.reports.some(r => r.severity === 'high') ? 'high' : 'medium';
        
        hotspots.push({
          lat: cell.lat,
          lng: cell.lng,
          intensity: cell.reports.length,
          radius: Math.min(cell.reports.length * 2000, 10000), // Max 10km radius
          reportCount: cell.reports.length
        });
      }
    });

    setHotspots(hotspots);
  };

  // Handle search input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchLocation(query);
  };

  // Handle search result selection
  const handleSearchResultClick = (result: SearchResult) => {
    if (mapRef.current) {
      mapRef.current.setView([result.lat, result.lng], 12);
    }
    setSearchQuery(result.name);
    setSearchResults([]);
  };

  // Effects
  useEffect(() => {
    calculateHotspots();
  }, [reports]);

  // Default center (Indian Ocean region)
  const defaultCenter: [number, number] = [12.9716, 77.5946]; // Bangalore, India
  const defaultZoom = 6;

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 bg-white/95 backdrop-blur-sm border-gray-200"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div className="font-medium text-sm">{result.name}</div>
                      <div className="text-xs text-gray-500">{result.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={getCurrentLocation}
              className="bg-white/95 backdrop-blur-sm"
            >
              <Navigation className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHotspots(!showHotspots)}
              className={`bg-white/95 backdrop-blur-sm ${showHotspots ? 'bg-blue-50' : ''}`}
            >
              <Thermometer className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Fit bounds to show all reports */}
        <FitBounds reports={reports} />
        
        {/* Render hotspots */}
        {showHotspots && hotspots.map((hotspot, index) => (
          <Circle
            key={`hotspot-${index}`}
            center={[hotspot.lat, hotspot.lng]}
            radius={hotspot.radius}
            pathOptions={{
              color: '#ff6b35',
              fillColor: '#ff6b35',
              fillOpacity: 0.2,
              weight: 2
            }}
          />
        ))}

        {/* Current location marker */}
        {showCurrentLocation && currentLocation && (
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={new Icon({
              iconUrl: `data:image/svg+xml;base64,${btoa(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
                  <circle cx="12" cy="12" r="4" fill="white"/>
                </svg>
              `)}`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>
              <div className="p-2">
                <div className="flex items-center">
                  <Navigation className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="font-medium">Your Location</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render markers for each report */}
        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.location.lat, report.location.lng]}
            icon={createCustomIcon(report.hazardType, report.severity)}
            eventHandlers={{
              click: () => setSelectedReport(report),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[250px]">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getSeverityColor(report.severity)}>
                    {report.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className={getStatusColor(report.status)}>
                    {report.status}
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-sm mb-1">{report.hazardType}</h3>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {report.description}
                </p>
                
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {report.reporterName}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTimeAgo(report.createdAt)}
                  </div>
                </div>
                
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={() => setSelectedReport(report)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Report Details Panel */}
      {selectedReport && (
        <div className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Report Details</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedReport(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={getSeverityColor(selectedReport.severity)}>
                    {selectedReport.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className={getStatusColor(selectedReport.status)}>
                    {selectedReport.status}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-1">{selectedReport.hazardType}</h4>
                  <p className="text-xs text-gray-600 mb-2">{selectedReport.description}</p>
                </div>
                
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 mr-2" />
                    {selectedReport.location.lat.toFixed(4)}, {selectedReport.location.lng.toFixed(4)}
                  </div>
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-2" />
                    {selectedReport.reporterName} ({selectedReport.reporterRole})
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-2" />
                    {formatTimeAgo(selectedReport.createdAt)}
                  </div>
                </div>
                
                {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Media ({selectedReport.mediaUrls.length})</p>
                    <div className="grid grid-cols-2 gap-1">
                      {selectedReport.mediaUrls.map((url, index) => (
                        <div key={index} className="bg-gray-100 rounded p-1 text-center text-xs">
                          Media {index + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hotspot information */}
                {(() => {
                  const nearbyHotspot = hotspots.find(hotspot => {
                    const distance = Math.sqrt(
                      Math.pow(hotspot.lat - selectedReport.location.lat, 2) + 
                      Math.pow(hotspot.lng - selectedReport.location.lng, 2)
                    );
                    return distance < 0.05; // Within ~5km
                  });
                  
                  return nearbyHotspot && (
                    <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                      <div className="flex items-center text-xs">
                        <Thermometer className="w-3 h-3 mr-1 text-orange-500" />
                        <span className="font-medium text-orange-700">Hotspot Area</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">
                        {nearbyHotspot.reportCount} reports in this area
                      </p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs max-w-48">
        <h4 className="font-semibold mb-2">Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span>Critical</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <span>High</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center mt-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span>Your Location</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2 opacity-50"></div>
            <span>Hotspots</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HazardMap;
