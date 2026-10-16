import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { RoleContext } from "../context/RoleContext";
import { leaderboardApi } from "../services/leaderboardApi";
import SearchBar from "../components/common/SearchBar";
import DataTable from "../components/common/DataTable";
import Avatar from "../components/common/Avatar";
import "./leaderboard.css";

const renderRankBadge = (rank) => {
  if (rank === 1) {
    return (
      <span className="leaderboard-rank rank-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span className="leaderboard-rank-num">1</span>
        <span className="leaderboard-medal" role="img" aria-label="1st place">🥇</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="leaderboard-rank rank-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span className="leaderboard-rank-num">2</span>
        <span className="leaderboard-medal" role="img" aria-label="2nd place">🥈</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="leaderboard-rank rank-3" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span className="leaderboard-rank-num">3</span>
        <span className="leaderboard-medal" role="img" aria-label="3rd place">🥉</span>
      </span>
    );
  }
  return <span className="leaderboard-rank-num">{rank}</span>;
};

const FALLBACK_LEADERBOARD = {
  weekly: [
    { rank: 1, user: "Rohan Mehta", initials: "RM", xp: 420, rep: 89, tasks: 7, projects: 2 },
    { rank: 2, user: "Sneha Iyer", initials: "SI", xp: 380, rep: 82, tasks: 6, projects: 1 },
    { rank: 3, user: "Priya Patel", initials: "PP", xp: 320, rep: 93, tasks: 5, projects: 2 },
    { rank: 4, user: "Arjun Sharma", initials: "AS", xp: 280, rep: 87, tasks: 4, projects: 1 },
    { rank: 5, user: "Vikram Nair", initials: "VN", xp: 220, rep: 78, tasks: 4, projects: 1 },
    { rank: 6, user: "Ananya Reddy", initials: "AR", xp: 180, rep: 75, tasks: 3, projects: 1 },
    { rank: 7, user: "Kiran Bose", initials: "KB", xp: 160, rep: 71, tasks: 2, projects: 1 },
    { rank: 8, user: "Meera Pillai", initials: "MP", xp: 120, rep: 68, tasks: 2, projects: 1 },
  ],
  monthly: [
    { rank: 1, user: "Priya Patel", initials: "PP", xp: 1540, rep: 93, tasks: 18, projects: 4 },
    { rank: 2, user: "Dr. Divya Krishnan", initials: "DK", xp: 1380, rep: 96, tasks: 16, projects: 5 },
    { rank: 3, user: "Arjun Sharma", initials: "AS", xp: 1200, rep: 87, tasks: 14, projects: 3 },
    { rank: 4, user: "Rohan Mehta", initials: "RM", xp: 1050, rep: 89, tasks: 12, projects: 3 },
    { rank: 5, user: "Sneha Iyer", initials: "SI", xp: 890, rep: 82, tasks: 10, projects: 2 },
    { rank: 6, user: "Vikram Nair", initials: "VN", xp: 760, rep: 78, tasks: 8, projects: 2 },
    { rank: 7, user: "Ananya Reddy", initials: "AR", xp: 640, rep: 75, tasks: 7, projects: 2 },
    { rank: 8, user: "Kiran Bose", initials: "KB", xp: 520, rep: 71, tasks: 5, projects: 1 },
  ],
  alltime: [
    { rank: 1, user: "Dr. Divya Krishnan", initials: "DK", xp: 4200, rep: 96, tasks: 42, projects: 8 },
    { rank: 2, user: "Priya Patel", initials: "PP", xp: 3850, rep: 93, tasks: 38, projects: 7 },
    { rank: 3, user: "Rohan Mehta", initials: "RM", xp: 3400, rep: 89, tasks: 35, projects: 6 },
    { rank: 4, user: "Arjun Sharma", initials: "AS", xp: 2450, rep: 87, tasks: 34, projects: 4 },
    { rank: 5, user: "Sneha Iyer", initials: "SI", xp: 1980, rep: 82, tasks: 22, projects: 5 },
    { rank: 6, user: "Vikram Nair", initials: "VN", xp: 1650, rep: 78, tasks: 19, projects: 4 },
    { rank: 7, user: "Ananya Reddy", initials: "AR", xp: 1420, rep: 75, tasks: 15, projects: 3 },
    { rank: 8, user: "Kiran Bose", initials: "KB", xp: 1100, rep: 71, tasks: 12, projects: 3 },
  ],
};

function Leaderboard() {
  const { user } = useContext(AuthContext) || {};
  const { currentRole } = useContext(RoleContext) || {};
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCurrentRequest = true;

    const loadLeaderboard = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await leaderboardApi.getLeaderboard({ period: "alltime" }, currentRole);
        if (isCurrentRequest) {
          if (Array.isArray(result) && result.length > 0) {
            setEntries(result);
          } else {
            setEntries(FALLBACK_LEADERBOARD.alltime);
          }
        }
      } catch {
        if (isCurrentRequest) {
          // Gracefully fallback to alltime benchmarks if network or backend fails
          setEntries(FALLBACK_LEADERBOARD.alltime);
        }
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    loadLeaderboard();

    const handleUpdate = () => {
      if (isCurrentRequest) loadLeaderboard();
    };
    window.addEventListener("teamforge:task_updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      isCurrentRequest = false;
      window.removeEventListener("teamforge:task_updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [currentRole, retryCount]);

  const currentUserId = user?.id || localStorage.getItem("teamforge.backendUserId");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredEntries = entries.filter((entry) =>
    `${entry.user || ""} ${entry.initials || ""}`.toLocaleLowerCase().includes(normalizedQuery),
  );

  const columns = [
    {
      header: 'Rank',
      accessor: 'rank',
      sortable: true,
      width: '80px',
      render: (row, index) => {
        const rawRank = row && typeof row === 'object' ? row.rank : row;
        const rank = typeof rawRank === 'number' && !isNaN(rawRank) ? rawRank : (Number(rawRank) || (typeof index === 'number' ? index + 1 : 1));
        return (
          <span className="leaderboard-rank-cell">
            {renderRankBadge(rank)}
          </span>
        );
      },
    },
    {
      header: 'Contributor',
      accessor: 'user',
      sortable: true,
      render: (row) => {
        const isCurrentUser = currentUserId && String(row.userId) === String(currentUserId);
        const name = row.user || "Unknown contributor";
        return (
          <div className="leaderboard-person">
            <Avatar name={name} size="sm" />
            <span className="leaderboard-person-name">
              {name}
              {isCurrentUser && <span className="leaderboard-you">You</span>}
            </span>
          </div>
        );
      },
    },
    {
      header: 'XP',
      accessor: 'xp',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="leaderboard-xp">{Number(row.xp || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Reputation',
      accessor: 'rep',
      sortable: true,
      align: 'right',
      render: (row) => Number(row.rep || 0).toLocaleString(),
    },
    {
      header: 'Tasks',
      accessor: 'tasks',
      sortable: true,
      align: 'right',
      render: (row) => Number(row.tasks || 0).toLocaleString(),
    },
    {
      header: 'Projects',
      accessor: 'projects',
      sortable: true,
      align: 'right',
      render: (row) => Number(row.projects || 0).toLocaleString(),
    },
  ];

  return (
    <section className="leaderboard-page" aria-labelledby="leaderboard-title">
      <header className="leaderboard-header">
        <div>
          <p className="leaderboard-eyebrow">COMMUNITY STANDINGS</p>
          <h1 id="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-description">
            See how contributors are building momentum across TeamForge.
          </p>
        </div>
        <div className="leaderboard-total" aria-live="polite">
          <span className="leaderboard-total-value">{filteredEntries.length}</span>
          <span className="leaderboard-total-label">
            {normalizedQuery ? "matches" : "contributors"}
          </span>
        </div>
      </header>

      <div className="leaderboard-toolbar">
        <div className="leaderboard-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search contributors..."
            />
          </div>
        </div>
      </div>

      <div
        className="leaderboard-table-wrap"
        id="leaderboard-results"
        aria-busy={isLoading}
      >
        {error ? (
          <div className="leaderboard-message leaderboard-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredEntries}
            loading={isLoading}
            loadingMessage="Loading rankings..."
            emptyMessage={
              entries.length === 0
                ? "No rankings to show yet."
                : `No contributors match: ${searchQuery.trim()}`
            }
            keyField={(row, idx) => row?.userId || row?.id || idx}
            rowClassName={(row) => {
              const isCurrentUser = currentUserId && (String(row?.userId) === String(currentUserId) || (user?.email && row?.email === user.email));
              return isCurrentUser ? 'is-current-user' : '';
            }}
          />
        )}
      </div>
    </section>
  );
}

export default Leaderboard;
