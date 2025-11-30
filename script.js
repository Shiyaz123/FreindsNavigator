// 🔥 Firebase config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQBpM6DFHWVcPyNPLjdSfrP3NAxc4FXu4",
  authDomain: "loc-live-track.firebaseapp.com",
  databaseURL: "https://loc-live-track-default-rtdb.firebaseio.com",
  projectId: "loc-live-track",
  storageBucket: "loc-live-track.firebasestorage.app",
  messagingSenderId: "1097169095550",
  appId: "1:1097169095550:web:34e63d85ee686cecc5012f",
  measurementId: "G-M2S6EZTPFL"
};

// OSRM Routing API (public instance)
const OSRM_API = "https://router.project-osrm.org/route/v1/driving";

// State
let db = null;
let userId = null;
let currentTeam = null;
let map = null;
let watchId = null;
let markers = {};
let waypointMarkers = {};
let meetupMarker = null;
let waypoints = [];
let waypointDropMode = false;
let myPosition = null;
let displayName = null;

// Wait for DOM and Firebase to be ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Init Firebase
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    
    // User ID
    userId = localStorage.getItem("fn_uid");
    if (!userId) {
      userId = "u_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("fn_uid", userId);
    }

    // Display name
    displayName = localStorage.getItem("fn_name") || userId;
    
    initApp();
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to initialize app. Check console for details.');
  }
});

function initApp() {
  // Views
  function show(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(view).classList.add("active");
  }

  // Elements
  const recentList = document.getElementById("recentList");
  const createName = document.getElementById("createName");
  const joinName = document.getElementById("joinName");
  const teamNameDisplay = document.getElementById("teamNameDisplay");
  const membersList = document.getElementById("membersList");
  const waypointsList = document.getElementById("waypointsList");

  // ============================================
  // 🟦 1. MAP SETUP FUNCTIONS
  // ============================================

  function initMap() {
    if (map) return;

    map = L.map('map').setView([12.97, 77.6], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Prepare layers
    map.on('click', onMapClick);
  }

  function initFirebaseListeners() {
    if (!currentTeam) return;
    
    // Listen for member updates
    db.ref(`teams/${currentTeam}/members`).on('value', onMembersUpdate);
    
    // Listen for waypoint updates
    db.ref(`teams/${currentTeam}/waypoints`).on('value', onWaypointsUpdate);
    
    // Listen for meetup updates
    db.ref(`teams/${currentTeam}/meetup`).on('value', onMeetupUpdate);
  }

  // ============================================
  // 🟩 2. GEOLOCATION FUNCTIONS
  // ============================================

  function startGeolocation() {
    if (watchId) stopGeolocation();

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        myPosition = { lat: latitude, lng: longitude };
        sendLocation(latitude, longitude);
      },
      error => {
        console.error("Geolocation error:", error);
        alert("Location access denied. Please enable location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function stopGeolocation() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function sendLocation(lat, lng) {
    if (!currentTeam) return;
    
    db.ref(`teams/${currentTeam}/members/${userId}`).update({
      id: userId,
      name: displayName,
      lat: lat,
      lng: lng,
      ts: Date.now()
    });
  }

  // ============================================
  // 🟧 3. MARKER HANDLING FUNCTIONS
  // ============================================

  function createUserMarker(userId, name, lat, lng) {
    if (markers[userId]) return markers[userId];

    const isMe = userId === window.userId;
    const icon = L.divIcon({
      className: 'user-marker' + (isMe ? ' me' : ''),
      html: `<div class="marker-pin ${isMe ? 'me' : ''}">${isMe ? 'YOU' : name?.charAt(0) || 'U'}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    
    if (name) {
      marker.bindPopup(name);
    }

    markers[userId] = marker;
    return marker;
  }

  function updateUserMarker(userId, lat, lng) {
    if (!markers[userId]) {
      const member = getMemberData(userId);
      createUserMarker(userId, member?.name, lat, lng);
      return;
    }

    const newPos = [lat, lng];
    animateMarkerMove(markers[userId], newPos);
  }

  function animateMarkerMove(marker, newPos, duration = 1000) {
    const startPos = marker.getLatLng();
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const lat = startPos.lat + (newPos[0] - startPos.lat) * easeProgress;
      const lng = startPos.lng + (newPos[1] - startPos.lng) * easeProgress;
      
      marker.setLatLng([lat, lng]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }

  function removeUserMarker(userId) {
    if (markers[userId]) {
      map.removeLayer(markers[userId]);
      delete markers[userId];
    }
  }

  function getMemberData(userId) {
    // This will be populated from Firebase
    return null;
  }

  // ============================================
  // 🟫 4. WAYPOINT FUNCTIONS
  // ============================================

  function enableWaypointDrop() {
    waypointDropMode = !waypointDropMode;
    const btn = document.getElementById("btnWaypointMode");
    
    if (waypointDropMode) {
      btn.classList.add("active");
      map.getContainer().style.cursor = "crosshair";
      btn.title = "Click map to add waypoint (Click again to cancel)";
    } else {
      btn.classList.remove("active");
      map.getContainer().style.cursor = "";
      btn.title = "Drop Waypoints";
    }
  }

  function addWaypoint(lat, lng, name = null) {
    if (!currentTeam) return;

    const wpId = "wp_" + Date.now();
    const waypoint = {
      id: wpId,
      lat: lat,
      lng: lng,
      name: name || `Waypoint ${waypoints.length + 1}`,
      order: waypoints.length,
      createdAt: Date.now()
    };

    db.ref(`teams/${currentTeam}/waypoints/${wpId}`).set(waypoint);
  }

  function renderWaypoint(waypoint) {
    if (waypointMarkers[waypoint.id]) {
      updateWaypoint(waypoint);
      return;
    }

    const isMeetup = meetupPoint && meetupPoint.waypointId === waypoint.id;
    const icon = L.divIcon({
      className: 'waypoint-marker' + (isMeetup ? ' meetup' : ''),
      html: `<div class="waypoint-pin ${isMeetup ? 'meetup' : ''}">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });

    const marker = L.marker([waypoint.lat, waypoint.lng], { icon })
      .addTo(map)
      .bindPopup(waypoint.name)
      .on('click', () => onWaypointClick(waypoint.id));

    waypointMarkers[waypoint.id] = marker;
  }

  function updateWaypoint(waypoint) {
    const marker = waypointMarkers[waypoint.id];
    if (!marker) {
      renderWaypoint(waypoint);
      return;
    }

    marker.setLatLng([waypoint.lat, waypoint.lng]);
    marker.setPopupContent(waypoint.name);
    
    const isMeetup = meetupPoint && meetupPoint.waypointId === waypoint.id;
    const icon = L.divIcon({
      className: 'waypoint-marker' + (isMeetup ? ' meetup' : ''),
      html: `<div class="waypoint-pin ${isMeetup ? 'meetup' : ''}">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
    marker.setIcon(icon);
  }

  function removeWaypoint(wpId) {
    if (waypointMarkers[wpId]) {
      map.removeLayer(waypointMarkers[wpId]);
      delete waypointMarkers[wpId];
    }
    
    waypoints = waypoints.filter(wp => wp.id !== wpId);
    updateWaypointsUI();
  }

  function onWaypointClick(wpId) {
    const waypoint = waypoints.find(wp => wp.id === wpId);
    if (!waypoint) return;

    const popup = L.popup()
      .setLatLng([waypoint.lat, waypoint.lng])
      .setContent(`
        <div class="waypoint-popup">
          <strong>${waypoint.name}</strong>
          <button onclick="setMeetupWaypoint('${wpId}')">Set as Meetup</button>
          <button onclick="removeWaypointById('${wpId}')">Remove</button>
          <button onclick="computeETAsForWaypoint('${wpId}')">Show ETAs</button>
        </div>
      `)
      .openOn(map);
  }

  // Global functions for popup buttons
  window.setMeetupWaypoint = (wpId) => setMeetupWaypoint(wpId);
  window.removeWaypointById = (wpId) => {
    if (!currentTeam) return;
    db.ref(`teams/${currentTeam}/waypoints/${wpId}`).remove();
  };
  window.computeETAsForWaypoint = (wpId) => computeETAsForWaypoint(wpId);

  // ============================================
  // 🟥 5. MEETUP HANDLING FUNCTIONS
  // ============================================

  function setMeetupWaypoint(wpId) {
    if (!currentTeam) return;
    
    const waypoint = waypoints.find(wp => wp.id === wpId);
    if (!waypoint) return;

    db.ref(`teams/${currentTeam}/meetup`).set({
      waypointId: wpId,
      lat: waypoint.lat,
      lng: waypoint.lng,
      name: waypoint.name,
      updatedAt: Date.now()
    });
  }

  function renderMeetupMarker(lat, lng) {
    if (meetupMarker) {
      meetupMarker.setLatLng([lat, lng]);
      return;
    }

    const icon = L.divIcon({
      className: 'meetup-marker',
      html: '<div class="meetup-pin">🎯 MEET HERE</div>',
      iconSize: [100, 40],
      iconAnchor: [50, 40]
    });

    meetupMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup("Meetup Point");
  }

  function highlightSelectedWaypoint(waypoint) {
    // Update all waypoint markers to show which is selected
    Object.keys(waypointMarkers).forEach(wpId => {
      const marker = waypointMarkers[wpId];
      const isSelected = waypoint && wpId === waypoint.id;
      
      const icon = L.divIcon({
        className: 'waypoint-marker' + (isSelected ? ' meetup' : ''),
        html: `<div class="waypoint-pin ${isSelected ? 'meetup' : ''}">📍</div>`,
        iconSize: isSelected ? [40, 40] : [30, 30],
        iconAnchor: isSelected ? [20, 40] : [15, 30]
      });
      marker.setIcon(icon);
    });
  }

  // ============================================
  // 🟨 6. ETA & ROUTING FUNCTIONS
  // ============================================

  async function computeETAsForWaypoint(wpId) {
    const waypoint = waypoints.find(wp => wp.id === wpId);
    if (!waypoint || !myPosition) {
      alert("Your location is not available");
      return;
    }

    const from = `${myPosition.lng},${myPosition.lat}`;
    const to = `${waypoint.lng},${waypoint.lat}`;
    const url = `${OSRM_API}/${from};${to}?overview=false`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const duration = Math.round(route.duration / 60); // minutes
        const distance = (route.distance / 1000).toFixed(1); // km
        
        showETAs([{
          waypoint: waypoint.name,
          duration: duration,
          distance: distance
        }]);
      } else {
        alert("Could not calculate route");
      }
    } catch (error) {
      console.error("ETA calculation error:", error);
      alert("Failed to calculate ETA");
    }
  }

  function showETAs(results) {
    const popup = document.getElementById("etaPopup");
    let html = "<strong>Estimated Time & Distance</strong><ul>";
    
    results.forEach(result => {
      html += `<li>${result.waypoint}: ${result.duration} min (${result.distance} km)</li>`;
    });
    html += "</ul>";
    
    popup.innerHTML = html;
    popup.style.display = "block";
    
    setTimeout(() => {
      popup.style.display = "none";
    }, 5000);
  }

  // ============================================
  // 🟪 7. FIREBASE EVENT HANDLERS
  // ============================================

  function onMembersUpdate(snap) {
    const members = snap.val() || {};
    membersList.innerHTML = "";

    Object.keys(members).forEach(id => {
      const m = members[id];
      
      // UI
      const row = document.createElement("div");
      row.className = "memberRow";
      row.textContent = m.name || m.id;
      if (id === userId) row.classList.add("me");
      membersList.appendChild(row);

      // Markers
      if (m.lat && m.lng) {
        if (markers[id]) {
          updateUserMarker(id, m.lat, m.lng);
        } else {
          createUserMarker(id, m.name || m.id, m.lat, m.lng);
        }
      }
    });

    // Remove markers for users who left
    Object.keys(markers).forEach(id => {
      if (!members[id]) {
        removeUserMarker(id);
      }
    });
  }

  function onWaypointsUpdate(snap) {
    const waypointsData = snap.val() || {};
    waypoints = Object.values(waypointsData).sort((a, b) => a.order - b.order);

    // Remove old markers
    Object.keys(waypointMarkers).forEach(wpId => {
      if (!waypointsData[wpId]) {
        removeWaypoint(wpId);
      }
    });

    // Render waypoints
    waypoints.forEach(wp => renderWaypoint(wp));
    
    updateWaypointsUI();
  }

  function onMeetupUpdate(snap) {
    const meetup = snap.val();
    meetupPoint = meetup;

    if (meetup && meetup.lat && meetup.lng) {
      renderMeetupMarker(meetup.lat, meetup.lng);
      
      if (meetup.waypointId) {
        const waypoint = waypoints.find(wp => wp.id === meetup.waypointId);
        if (waypoint) {
          highlightSelectedWaypoint(waypoint);
        }
      }
    } else if (meetupMarker) {
      map.removeLayer(meetupMarker);
      meetupMarker = null;
    }
  }

  // ============================================
  // 🟫 8. UI FUNCTIONS
  // ============================================

  function handleLeaveTeam() {
    if (confirm("Leave this team?")) {
      cleanupBeforeExit();
      show("homeView");
    }
  }

  function updateDisplayName() {
    const name = prompt("Enter your display name:", displayName);
    if (name && name.trim()) {
      displayName = name.trim();
      localStorage.setItem("fn_name", displayName);
      if (currentTeam) {
        db.ref(`teams/${currentTeam}/members/${userId}`).update({ name: displayName });
      }
    }
  }

  function recenterToUser() {
    if (myPosition && map) {
      map.setView([myPosition.lat, myPosition.lng], 15, { animate: true });
    } else {
      alert("Your location is not available");
    }
  }

  function toggleWaypointPanel() {
    const panel = document.querySelector(".panel");
    panel.classList.toggle("collapsed");
  }

  function updateWaypointsUI() {
    waypointsList.innerHTML = "";
    
    if (waypoints.length === 0) {
      waypointsList.innerHTML = "<p style='opacity:0.6;'>No waypoints yet</p>";
      return;
    }

    waypoints.forEach((wp, index) => {
      const item = document.createElement("div");
      item.className = "waypoint-item";
      item.innerHTML = `
        <span>${index + 1}. ${wp.name}</span>
        <div class="waypoint-actions">
          <button onclick="setMeetupWaypoint('${wp.id}')" class="small">Set Meetup</button>
          <button onclick="removeWaypointById('${wp.id}')" class="small outline">Remove</button>
        </div>
      `;
      waypointsList.appendChild(item);
    });
  }

  // ============================================
  // 🟦 9. DATA MANAGEMENT FUNCTIONS
  // ============================================

  function loadInitialTeamData(teamId) {
    db.ref(`teams/${teamId}`).once('value', snap => {
      const team = snap.val();
      if (team) {
        teamNameDisplay.textContent = team.name || teamId;
      }
    });
  }

  function syncMembers() {
    // Handled by Firebase listeners
  }

  function syncWaypoints() {
    // Handled by Firebase listeners
  }

  // ============================================
  // 🟩 10. CLEANUP
  // ============================================

  function cleanupBeforeExit() {
    stopGeolocation();
    
    // Remove all markers
    Object.keys(markers).forEach(id => removeUserMarker(id));
    Object.keys(waypointMarkers).forEach(id => removeWaypoint(id));
    
    if (meetupMarker) {
      map.removeLayer(meetupMarker);
      meetupMarker = null;
    }

    // Remove from team
    if (currentTeam) {
      db.ref(`teams/${currentTeam}/members/${userId}`).remove();
    }

    // Clear Firebase listeners
    if (currentTeam) {
      db.ref(`teams/${currentTeam}/members`).off();
      db.ref(`teams/${currentTeam}/waypoints`).off();
      db.ref(`teams/${currentTeam}/meetup`).off();
    }

    currentTeam = null;
    waypointDropMode = false;
    map.getContainer().style.cursor = "";
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function onMapClick(e) {
    if (waypointDropMode) {
      addWaypoint(e.latlng.lat, e.latlng.lng);
      enableWaypointDrop(); // Turn off after adding
    }
  }

  // Load recent teams
  function loadRecent() {
    db.ref("recentTeams").limitToLast(20).on("value", snap => {
      recentList.innerHTML = "";
      const teams = snap.val() || {};

      Object.keys(teams).reverse().forEach(id => {
        const li = document.createElement("li");
        li.textContent = teams[id].name + " — Join";
        li.style.padding = "10px";
        li.style.cursor = "pointer";
        li.onclick = () => joinTeam(id);
        recentList.appendChild(li);
      });
    });
  }

  // Create team
  document.getElementById("btnCreate").onclick = () => show("createView");
  document.getElementById("createCancel").onclick = () => show("homeView");

  document.getElementById("createSubmit").onclick = async () => {
    const name = createName.value.trim() || "Team";
    const id = name.replace(/[^a-zA-Z0-9]/g, "") + "_" + Date.now().toString(36);

    try {
      await db.ref("teams/" + id).set({ name, createdAt: Date.now() });
      await db.ref("recentTeams/" + id).set({ name });
      joinTeam(id);
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team. Check console for details.");
    }
  };

  // Join team
  document.getElementById("btnJoin").onclick = () => show("joinView");
  document.getElementById("joinCancel").onclick = () => show("homeView");

  document.getElementById("joinSubmit").onclick = () => {
    joinTeam(joinName.value.trim());
  };

  // Join team handler
  function joinTeam(teamId) {
    if (!teamId) return alert("Enter a valid team ID");

    currentTeam = teamId;
    window.userId = userId; // For global functions
    
    show("mapView");
    teamNameDisplay.textContent = teamId;

    // Initialize map
    initMap();

    // Add user to team
    db.ref(`teams/${teamId}/members/${userId}`).set({
      id: userId,
      name: displayName,
      lat: null,
      lng: null,
      ts: Date.now()
    });

    // Start location tracking
    startGeolocation();

    // Load initial data
    loadInitialTeamData(teamId);
    
    // Set up Firebase listeners
    initFirebaseListeners();
  }

  // Map controls
  document.getElementById("btnWaypointMode").onclick = enableWaypointDrop;
  document.getElementById("btnRecenter").onclick = recenterToUser;
  document.getElementById("btnWaypointPanel").onclick = toggleWaypointPanel;
  document.getElementById("leaveTeam").onclick = handleLeaveTeam;
  document.getElementById("btnAddWaypoint").onclick = () => {
    if (myPosition) {
      addWaypoint(myPosition.lat, myPosition.lng);
    } else {
      enableWaypointDrop();
      alert("Click on the map to add a waypoint");
    }
  };

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add("active");
    };
  });

  // Panel close
  document.getElementById("btnClosePanel").onclick = () => {
    document.querySelector(".panel").classList.add("collapsed");
  };

  // Initialize
  loadRecent();
}
