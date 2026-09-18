import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_LEADERBOARD = {
  weekly: [],
  monthly: [],
  alltime: [],
};

function getInitialsFromName(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TF";
}

export default function Leaderboard({
  leaderboard = DEFAULT_LEADERBOARD,
  currentUser = null,
  projects = [],
  getCurrentUserRecord = null,
  getProjectRuntime = null,
  onViewUserProfile = null,
  initialPeriod = "weekly",
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [leaderboardData, setLeaderboardData] = useState({
    ...DEFAULT_LEADERBOARD,
    ...leaderboard,
  });

  useEffect(() => {
    setLeaderboardData((prev) => ({
      ...DEFAULT_LEADERBOARD,
      ...prev,
      ...leaderboard,
    }));
  }, [leaderboard]);

  useEffect(() => {
    let isMounted = true;

    const fetchLeaderboard = async () => {
      if (typeof window === "undefined" || !window.leaderboardApi) {
        return;
      }

      try {
        const backendLeaderboard = await window.leaderboardApi.getLeaderboard({
          period: selectedPeriod,
        });

        if (!isMounted || !Array.isArray(backendLeaderboard)) {
          return;
        }

        setLeaderboardData((prev) => ({
          ...DEFAULT_LEADERBOARD,
          ...prev,
          [selectedPeriod]: backendLeaderboard.map((entry) => ({
            rank: Number(entry.rank || 0),
            user: entry.user || entry.userId || "Unknown",
            initials: entry.initials || getInitialsFromName(entry.user || "Unknown"),
            xp: Number(entry.xp || 0),
            rep: Number(entry.rep || 0),
            tasks: Number(entry.tasks || 0),
            projects: Number(entry.projects || 0),
          })),
        }));
      } catch (error) {
        console.warn("Backend unavailable for leaderboard, using fallback data.", error);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [selectedPeriod]);

  const buildLeaderboardRows = useMemo(() => {
    const rows = Array.isArray(leaderboardData?.[selectedPeriod])
      ? [...leaderboardData[selectedPeriod]]
      : [];

    const currentName = currentUser?.name || "TeamForge User";
    const currentInitials = currentUser?.initials || "TF";
    const currentRecord =
      typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;

    const currentProjects = Array.isArray(projects)
      ? projects.filter((project) => {
          const isOwner = project.owner === currentName;
          const isMember = Array.isArray(project.members)
            ? project.members.some((member) => member.name === currentName)
            : false;
          return isOwner || isMember;
        }).length
      : 0;

    const currentTasks = Array.isArray(projects)
      ? projects.reduce((count, project) => {
          const runtime =
            typeof getProjectRuntime === "function"
              ? getProjectRuntime(project)
              : project?.runtime;

          const tasks = Array.isArray(runtime?.tasks) ? runtime.tasks : [];
          return (
            count +
            tasks.filter(
              (task) => String(task.assignee || "").trim() === currentName,
            ).length
          );
        }, 0)
      : 0;

    const existingIndex = rows.findIndex((row) => row.user === currentName);
    const currentRow = {
      user: currentName,
      initials: currentInitials,
      xp: Number(currentRecord?.profile?.xp ?? 0),
      rep: Number(currentRecord?.profile?.rep ?? 0),
      tasks: currentTasks,
      projects: currentProjects,
    };

    if (existingIndex >= 0) {
      rows[existingIndex] = { ...rows[existingIndex], ...currentRow };
    } else {
      rows.push(currentRow);
    }

    return rows
      .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [leaderboardData, currentUser, projects, getCurrentUserRecord, getProjectRuntime, selectedPeriod]);

  const handleViewProfile = (row) => {
    if (typeof onViewUserProfile === "function") {
      onViewUserProfile(row.user, row.initials);
      return;
    }

    if (typeof window !== "undefined" && typeof window.navigate === "function") {
      window.navigate("profile");
    }
  };

  const rankIcon = (rank) =>
    rank === 1 ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;

  const rankColor = (rank) => {
    if (rank === 1) return "background:var(--warning)";
    if (rank === 2) return "background:#94a3b8";
    if (rank === 3) return "background:var(--accent)";
    return "background:var(--primary)";
  };

  return (
    <div id="page-leaderboard" className="leaderboard-page">
      <div className="leaderboard-tabs">
        {Object.keys(DEFAULT_LEADERBOARD).map((period) => (
          <button
            key={period}
            type="button"
            className={`tab ${selectedPeriod === period ? "active" : ""}`}
            onClick={() => setSelectedPeriod(period)}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>XP</th>
            <th>Rep</th>
            <th>Tasks</th>
            <th>Projects</th>
          </tr>
        </thead>
        <tbody id="leaderboard-body">
          {buildLeaderboardRows.map((row) => (
            <tr
              key={`${row.user}-${row.rank}`}
              className="clickable-row"
              onClick={() => handleViewProfile(row)}
              style={{ cursor: "pointer" }}
            >
              <td>{rankIcon(row.rank)}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="rank-avatar" style={rankColor(row.rank)}>
                    {row.initials || "TF"}
                  </div>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>
                    {row.user}
                  </span>
                </div>
              </td>
              <td className="font-semibold" style={{ color: "var(--fg)" }}>
                {Number(row.xp || 0).toLocaleString()}
              </td>
              <td>{row.rep}</td>
              <td>{row.tasks}</td>
              <td>{row.projects}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
