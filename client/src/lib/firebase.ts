import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, remove, push, update, query, orderByChild, limitToLast } from "firebase/database";
import type { Team, TeamMember, MeetupPoint, RecentTeam, Location } from "@shared/schema";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export function getUserId(): string {
  let userId = localStorage.getItem("friendsNavigator_userId");
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("friendsNavigator_userId", userId);
  }
  return userId;
}

export function getUserName(): string {
  return localStorage.getItem("friendsNavigator_userName") || "";
}

export function setUserName(name: string): void {
  localStorage.setItem("friendsNavigator_userName", name);
}

export async function createTeam(name: string, creatorId: string): Promise<string> {
  const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
  const teamRef = ref(database, `teams/${teamId}`);
  
  const team: Team = {
    id: teamId,
    name,
    createdAt: Date.now(),
    createdBy: creatorId,
  };
  
  try {
    await set(teamRef, team);
    saveRecentTeam({ id: teamId, name, joinedAt: Date.now() });
    return teamId;
  } catch (error) {
    console.error("Firebase createTeam error:", error);
    throw error;
  }
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const teamRef = ref(database, `teams/${teamId}`);
  const snapshot = await get(teamRef);
  
  if (snapshot.exists()) {
    return snapshot.val() as Team;
  }
  return null;
}

export async function teamExists(teamId: string): Promise<boolean> {
  const team = await getTeam(teamId);
  return team !== null;
}

export async function joinTeam(teamId: string, userId: string, userName: string): Promise<void> {
  const memberRef = ref(database, `teams/${teamId}/members/${userId}`);
  const member: TeamMember = {
    id: userId,
    name: userName || userId.slice(0, 8),
    lastUpdated: Date.now(),
  };
  
  await set(memberRef, member);
  
  const team = await getTeam(teamId);
  if (team) {
    saveRecentTeam({ id: teamId, name: team.name, joinedAt: Date.now() });
  }
}

export async function updateMemberLocation(teamId: string, userId: string, location: Location): Promise<void> {
  const memberRef = ref(database, `teams/${teamId}/members/${userId}`);
  await update(memberRef, {
    location,
    lastUpdated: Date.now(),
  });
}

export async function setMeetupPoint(teamId: string, point: MeetupPoint): Promise<void> {
  const meetupRef = ref(database, `teams/${teamId}/meetupPoint`);
  await set(meetupRef, {
    ...point,
    timestamp: Date.now(),
  });
}

export async function removeMeetupPoint(teamId: string): Promise<void> {
  const meetupRef = ref(database, `teams/${teamId}/meetupPoint`);
  await remove(meetupRef);
}

export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  const memberRef = ref(database, `teams/${teamId}/members/${userId}`);
  await remove(memberRef);
}

export function subscribeToTeam(teamId: string, callback: (team: Team | null) => void): () => void {
  const teamRef = ref(database, `teams/${teamId}`);
  const unsubscribe = onValue(teamRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as Team);
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
}

export function saveRecentTeam(team: RecentTeam): void {
  const recentTeams = getRecentTeams();
  const existingIndex = recentTeams.findIndex((t) => t.id === team.id);
  
  if (existingIndex >= 0) {
    recentTeams[existingIndex] = team;
  } else {
    recentTeams.unshift(team);
  }
  
  const trimmedTeams = recentTeams.slice(0, 10);
  localStorage.setItem("friendsNavigator_recentTeams", JSON.stringify(trimmedTeams));
}

export function getRecentTeams(): RecentTeam[] {
  const stored = localStorage.getItem("friendsNavigator_recentTeams");
  if (stored) {
    try {
      return JSON.parse(stored) as RecentTeam[];
    } catch {
      return [];
    }
  }
  return [];
}

export function removeRecentTeam(teamId: string): void {
  const recentTeams = getRecentTeams().filter((t) => t.id !== teamId);
  localStorage.setItem("friendsNavigator_recentTeams", JSON.stringify(recentTeams));
}

export async function fetchRecentTeamsFromFirebase(limit: number = 10): Promise<RecentTeam[]> {
  try {
    const teamsRef = ref(database, "teams");
    const teamsQuery = query(teamsRef, orderByChild("createdAt"), limitToLast(limit));
    const snapshot = await get(teamsQuery);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const teams: RecentTeam[] = [];
    snapshot.forEach((child) => {
      const team = child.val() as Team;
      teams.push({
        id: team.id,
        name: team.name,
        joinedAt: team.createdAt,
      });
    });
    
    return teams.reverse();
  } catch (error) {
    console.error("Error fetching teams from Firebase:", error);
    return [];
  }
}

export function subscribeToRecentTeams(
  limit: number = 10,
  callback: (teams: RecentTeam[]) => void
): () => void {
  const teamsRef = ref(database, "teams");
  const teamsQuery = query(teamsRef, orderByChild("createdAt"), limitToLast(limit));
  
  const unsubscribe = onValue(teamsQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const teams: RecentTeam[] = [];
    snapshot.forEach((child) => {
      const team = child.val() as Team;
      teams.push({
        id: team.id,
        name: team.name,
        joinedAt: team.createdAt,
      });
    });
    
    callback(teams.reverse());
  });
  
  return unsubscribe;
}

export { database, ref, onValue };
