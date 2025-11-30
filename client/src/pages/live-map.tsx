import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  getUserId,
  getUserName,
  subscribeToTeam,
  updateMemberLocation,
  setMeetupPoint,
  removeMeetupPoint,
  leaveTeam,
  joinTeam,
} from "@/lib/firebase";
import { getMapboxToken, getDirections, formatDuration, formatDistance } from "@/lib/mapbox";
import type { Team, TeamMember, MeetupPoint, Location, MemberWithETA } from "@shared/schema";
import { getColorForMember } from "@shared/schema";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Users,
  Clock,
  Copy,
  Check,
  X,
  Target,
  Crosshair,
} from "lucide-react";

mapboxgl.accessToken = getMapboxToken();

export default function LiveMap() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId || "";
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const meetupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourcesRef = useRef<Set<string>>(new Set());
  const watchIdRef = useRef<number | null>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [myLocation, setMyLocation] = useState<Location | null>(null);
  const [membersWithETA, setMembersWithETA] = useState<MemberWithETA[]>([]);
  const [isSettingMeetup, setIsSettingMeetup] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(true);

  const userId = getUserId();
  const userName = getUserName();

  useEffect(() => {
    if (!teamId) return;

    const handleTeamJoin = async () => {
      try {
        await joinTeam(teamId, userId, userName || "You");
      } catch (error) {
        console.error("Error joining team:", error);
      }
    };

    handleTeamJoin();

    const unsubscribe = subscribeToTeam(teamId, (teamData) => {
      if (teamData) {
        setTeam(teamData);
      } else {
        toast({
          title: "Team not found",
          description: "This team may have been deleted",
          variant: "destructive",
        });
        setLocationPath("/");
      }
    });

    return () => unsubscribe();
  }, [teamId, userId, userName, toast, setLocationPath]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.5, 40],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    map.current.on("click", (e) => {
      if (isSettingMeetup) {
        const point: MeetupPoint = {
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          setBy: userId,
        };
        setMeetupPoint(teamId, point);
        setIsSettingMeetup(false);
        toast({
          title: "Meet-up point set",
          description: "All team members can now see directions",
        });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isSettingMeetup, teamId, userId, toast]);

  useEffect(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support location tracking",
        variant: "destructive",
      });
      return;
    }

    const handlePosition = (position: GeolocationPosition) => {
      const location: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: Date.now(),
      };
      setMyLocation(location);
      updateMemberLocation(teamId, userId, location);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error);
      toast({
        title: "Location access denied",
        description: "Please enable location access to share your position",
        variant: "destructive",
      });
    };

    navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [teamId, userId, toast]);

  useEffect(() => {
    if (!myLocation || !map.current || !mapLoaded) return;

    map.current.flyTo({
      center: [myLocation.lng, myLocation.lat],
      zoom: 14,
      essential: true,
    });
  }, [myLocation, mapLoaded]);

  const updateMarkers = useCallback(() => {
    if (!map.current || !mapLoaded || !team) return;

    const members = team.members ? Object.values(team.members) : [];
    const currentMarkerIds = new Set(markersRef.current.keys());

    members.forEach((member, index) => {
      if (!member.location) return;

      const markerId = member.id;
      const color = getColorForMember(index);
      const isMe = member.id === userId;

      if (markersRef.current.has(markerId)) {
        const marker = markersRef.current.get(markerId)!;
        marker.setLngLat([member.location.lng, member.location.lat]);
        currentMarkerIds.delete(markerId);
      } else {
        const el = document.createElement("div");
        el.className = "member-marker";
        el.style.cssText = `
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s ease;
          ${isMe ? "box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0,0,0,0.3);}" : ""}
        `;
        el.textContent = (member.name || member.id).charAt(0).toUpperCase();

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px 12px; font-family: system-ui;">
            <div style="font-weight: 600; font-size: 14px;">${member.name || member.id}</div>
            ${isMe ? '<div style="color: #6b7280; font-size: 12px;">You</div>' : ""}
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([member.location.lng, member.location.lat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.set(markerId, marker);
      }
    });

    currentMarkerIds.forEach((id) => {
      if (id !== "meetup") {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    });
  }, [team, mapLoaded, userId]);

  const updateMeetupMarker = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    if (!team?.meetupPoint) {
      if (meetupMarkerRef.current) {
        meetupMarkerRef.current.remove();
        meetupMarkerRef.current = null;
      }
      return;
    }

    const { lat, lng } = team.meetupPoint;

    if (meetupMarkerRef.current) {
      meetupMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "meetup-marker";
      el.innerHTML = `
        <div style="
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          animation: pulse 2s infinite;
        ">
          <div style="transform: rotate(45deg); color: white;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `;

      const style = document.createElement("style");
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: rotate(-45deg) scale(1); }
          50% { transform: rotate(-45deg) scale(1.1); }
        }
      `;
      document.head.appendChild(style);

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px 12px; font-family: system-ui;">
          <div style="font-weight: 600; font-size: 14px; color: #dc2626;">Meet-up Point</div>
          <div style="color: #6b7280; font-size: 12px;">Everyone is heading here</div>
        </div>
      `);

      meetupMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);
    }
  }, [team?.meetupPoint, mapLoaded]);

  const updateRoutes = useCallback(async () => {
    if (!map.current || !mapLoaded || !team?.meetupPoint || !team?.members) return;

    const members = Object.values(team.members);
    const newMembersWithETA: MemberWithETA[] = [];

    routeSourcesRef.current.forEach((sourceId) => {
      if (map.current?.getLayer(`${sourceId}-layer`)) {
        map.current.removeLayer(`${sourceId}-layer`);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });
    routeSourcesRef.current.clear();

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member.location) {
        newMembersWithETA.push(member);
        continue;
      }

      const route = await getDirections(member.location, team.meetupPoint);

      if (route && map.current) {
        const sourceId = `route-${member.id}`;
        const color = getColorForMember(i);

        map.current.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: `${sourceId}-layer`,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": color,
            "line-width": 4,
            "line-opacity": 0.7,
          },
        });

        routeSourcesRef.current.add(sourceId);

        newMembersWithETA.push({
          ...member,
          eta: route.duration,
          distance: route.distance,
          route,
        });
      } else {
        newMembersWithETA.push(member);
      }
    }

    setMembersWithETA(newMembersWithETA);
  }, [team?.meetupPoint, team?.members, mapLoaded]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    updateMeetupMarker();
  }, [updateMeetupMarker]);

  useEffect(() => {
    if (team?.meetupPoint) {
      updateRoutes();
    } else {
      setMembersWithETA(team?.members ? Object.values(team.members) : []);
    }
  }, [team?.meetupPoint, updateRoutes, team?.members]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(teamId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Code copied",
        description: "Share this code with your friends",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  const handleLeaveTeam = async () => {
    try {
      await leaveTeam(teamId, userId);
      setLocationPath("/");
    } catch (error) {
      toast({
        title: "Error leaving team",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMeetup = async () => {
    try {
      await removeMeetupPoint(teamId);
      toast({
        title: "Meet-up point removed",
      });
    } catch (error) {
      toast({
        title: "Error removing meet-up point",
        variant: "destructive",
      });
    }
  };

  const handleCenterOnMe = () => {
    if (myLocation && map.current) {
      map.current.flyTo({
        center: [myLocation.lng, myLocation.lat],
        zoom: 15,
        essential: true,
      });
    }
  };

  const handleCenterOnMeetup = () => {
    if (team?.meetupPoint && map.current) {
      map.current.flyTo({
        center: [team.meetupPoint.lng, team.meetupPoint.lat],
        zoom: 15,
        essential: true,
      });
    }
  };

  const members = membersWithETA.length > 0 ? membersWithETA : (team?.members ? Object.values(team.members) : []);

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" data-testid="map-container" />

      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={() => setLocationPath("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <Card className="backdrop-blur-md bg-background/90 shadow-lg border-0">
          <CardContent className="px-6 py-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-semibold" data-testid="text-team-name">
              {team?.name || "Loading..."}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={handleCopyCode}
              data-testid="button-copy-code"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="font-mono text-xs">{teamId.slice(0, 12)}...</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={handleCenterOnMe}
          data-testid="button-center-me"
        >
          <Crosshair className="w-5 h-5" />
        </Button>
        {team?.meetupPoint && (
          <Button
            variant="secondary"
            size="icon"
            className="w-12 h-12 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
            onClick={handleCenterOnMeetup}
            data-testid="button-center-meetup"
          >
            <Target className="w-5 h-5 text-destructive" />
          </Button>
        )}
      </div>

      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-3">
        {team?.meetupPoint && (
          <Button
            variant="destructive"
            size="icon"
            className="w-14 h-14 rounded-full shadow-lg"
            onClick={handleRemoveMeetup}
            data-testid="button-remove-meetup"
          >
            <X className="w-6 h-6" />
          </Button>
        )}
        <Button
          className={`w-14 h-14 rounded-full shadow-lg ${
            isSettingMeetup ? "bg-destructive hover:bg-destructive/90" : ""
          }`}
          onClick={() => setIsSettingMeetup(!isSettingMeetup)}
          data-testid="button-set-meetup"
        >
          <MapPin className="w-6 h-6" />
        </Button>
      </div>

      {isSettingMeetup && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
          <Card className="backdrop-blur-md bg-primary text-primary-foreground shadow-lg border-0">
            <CardContent className="px-6 py-3 text-center">
              <p className="font-medium">Tap on the map to set meet-up point</p>
            </CardContent>
          </Card>
        </div>
      )}

      {showMemberPanel && (
        <div className="absolute bottom-0 left-0 right-0 z-10 md:left-auto md:right-4 md:bottom-4 md:w-80">
          <Card className="rounded-t-3xl md:rounded-2xl backdrop-blur-md bg-background/95 shadow-xl border-t md:border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Team Members</span>
                  <Badge variant="secondary" className="ml-1">
                    {members.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleLeaveTeam}
                  data-testid="button-leave-team"
                >
                  Leave
                </Button>
              </div>

              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {members.map((member, index) => {
                    const isMe = member.id === userId;
                    const color = getColorForMember(index);
                    const memberWithETA = member as MemberWithETA;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        data-testid={`member-row-${member.id}`}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: color }}
                        >
                          {(member.name || member.id).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {member.name || member.id.slice(0, 8)}
                            </span>
                            {isMe && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          {team?.meetupPoint && memberWithETA.eta !== undefined && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(memberWithETA.eta)}</span>
                              <span className="text-muted-foreground/60">
                                ({formatDistance(memberWithETA.distance || 0)})
                              </span>
                            </div>
                          )}
                          {!member.location && (
                            <span className="text-sm text-muted-foreground">
                              Waiting for location...
                            </span>
                          )}
                        </div>
                        {member.location && (
                          <div
                            className="w-2 h-2 rounded-full bg-green-500"
                            title="Online"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-4 left-4 z-10 md:hidden rounded-full shadow-lg backdrop-blur-sm bg-background/80"
        onClick={() => setShowMemberPanel(!showMemberPanel)}
        data-testid="button-toggle-panel"
      >
        <Users className="w-4 h-4 mr-2" />
        {showMemberPanel ? "Hide" : "Show"} Members
      </Button>
    </div>
  );
}
