import { z } from "zod";

export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.number().optional(),
});

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  location: locationSchema.optional(),
  color: z.string().optional(),
  lastUpdated: z.number().optional(),
});

export const meetupPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  name: z.string().optional(),
  setBy: z.string().optional(),
  timestamp: z.number().optional(),
});

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  createdBy: z.string(),
  meetupPoint: meetupPointSchema.optional(),
  members: z.record(z.string(), teamMemberSchema).optional(),
});

export const recentTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  joinedAt: z.number(),
});

export type Location = z.infer<typeof locationSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type MeetupPoint = z.infer<typeof meetupPointSchema>;
export type Team = z.infer<typeof teamSchema>;
export type RecentTeam = z.infer<typeof recentTeamSchema>;

export interface DirectionsRoute {
  duration: number;
  distance: number;
  geometry: {
    coordinates: [number, number][];
  };
}

export interface MemberWithETA extends TeamMember {
  eta?: number;
  distance?: number;
  route?: DirectionsRoute;
}

export const MEMBER_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#c026d3", // fuchsia
  "#65a30d", // lime
];

export function getColorForMember(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}
