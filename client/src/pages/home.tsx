import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getUserId,
  getUserName,
  setUserName,
  createTeam,
  teamExists,
  joinTeam,
  getRecentTeams,
  removeRecentTeam,
  subscribeToRecentTeams,
} from "@/lib/firebase";
import type { RecentTeam } from "@shared/schema";
import { MapPin, Users, Plus, LogIn, Clock, X, Navigation } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [firebaseTeams, setFirebaseTeams] = useState<RecentTeam[]>([]);
  const [myRecentTeams, setMyRecentTeams] = useState<RecentTeam[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [userName, setUserNameInput] = useState(getUserName());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  useEffect(() => {
    setMyRecentTeams(getRecentTeams());
    
    const unsubscribe = subscribeToRecentTeams(10, (teams) => {
      setFirebaseTeams(teams);
      setIsLoadingTeams(false);
    });
    
    return () => unsubscribe();
  }, []);

  const allTeams = [...myRecentTeams];
  firebaseTeams.forEach((team) => {
    if (!allTeams.some((t) => t.id === team.id)) {
      allTeams.push(team);
    }
  });
  allTeams.sort((a, b) => b.joinedAt - a.joinedAt);
  const recentTeams = allTeams.slice(0, 10);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a name for your team",
        variant: "destructive",
      });
      return;
    }

    if (userName.trim()) {
      setUserName(userName.trim());
    }

    setIsLoading(true);
    try {
      const userId = getUserId();
      const teamId = await createTeam(teamName.trim(), userId);
      await joinTeam(teamId, userId, userName.trim() || "You");
      setShowCreateDialog(false);
      setLocation(`/map/${teamId}`);
    } catch (error: any) {
      console.error("Create team error:", error);
      let errorMessage = "Please try again";
      if (error?.code === "PERMISSION_DENIED") {
        errorMessage = "Database permissions need to be configured. Please check your Firebase Realtime Database rules.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error creating team",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    const cleanCode = teamCode.trim().toUpperCase();
    if (!cleanCode) {
      toast({
        title: "Team code required",
        description: "Please enter the team code",
        variant: "destructive",
      });
      return;
    }

    if (userName.trim()) {
      setUserName(userName.trim());
    }

    setIsLoading(true);
    try {
      const exists = await teamExists(cleanCode);
      if (!exists) {
        toast({
          title: "Team not found",
          description: "Check the team code and try again",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const userId = getUserId();
      await joinTeam(cleanCode, userId, userName.trim() || "You");
      setShowJoinDialog(false);
      setLocation(`/map/${cleanCode}`);
    } catch (error) {
      toast({
        title: "Error joining team",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickJoin = (team: RecentTeam) => {
    setLocation(`/map/${team.id}`);
  };

  const handleRemoveRecent = (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    removeRecentTeam(teamId);
    setMyRecentTeams(getRecentTeams());
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <Navigation className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight" data-testid="text-app-title">
              FriendsNavigator
            </h1>
            <p className="text-muted-foreground text-lg">
              Find your friends and meet up together
            </p>
          </div>

          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full h-16 text-lg rounded-xl gap-3"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-team"
            >
              <Plus className="w-6 h-6" />
              Create Team
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-16 text-lg rounded-xl gap-3"
              onClick={() => setShowJoinDialog(true)}
              data-testid="button-join-team"
            >
              <LogIn className="w-6 h-6" />
              Join Team
            </Button>
          </div>

          <div className="space-y-4 pt-8">
            <h2 className="text-lg font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Teams
            </h2>
            {isLoadingTeams ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : recentTeams.length > 0 ? (
              <div className="space-y-3">
                {recentTeams.map((team) => (
                  <Card
                    key={team.id}
                    className="cursor-pointer hover-elevate transition-all duration-200"
                    onClick={() => handleQuickJoin(team)}
                    data-testid={`card-recent-team-${team.id}`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" data-testid={`text-team-name-${team.id}`}>
                            {team.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatTimeAgo(team.joinedAt)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={(e) => handleRemoveRecent(e, team.id)}
                        data-testid={`button-remove-team-${team.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No teams yet</p>
                  <p className="text-sm">Create or join a team to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create a Team</DialogTitle>
            <DialogDescription>
              Give your team a name and invite friends to join
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserNameInput(e.target.value)}
                data-testid="input-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                placeholder="e.g., Weekend Hiking Group"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                data-testid="input-team-name"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateTeam}
              disabled={isLoading}
              data-testid="button-confirm-create"
            >
              {isLoading ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Join a Team</DialogTitle>
            <DialogDescription>
              Enter the team code shared by your friend
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="joinUserName">Your Name</Label>
              <Input
                id="joinUserName"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserNameInput(e.target.value)}
                data-testid="input-join-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamCode">Team Code</Label>
              <Input
                id="teamCode"
                placeholder="e.g., TEAM_123456_ABC123"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinTeam()}
                className="font-mono uppercase"
                data-testid="input-team-code"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleJoinTeam}
              disabled={isLoading}
              data-testid="button-confirm-join"
            >
              {isLoading ? "Joining..." : "Join Team"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
