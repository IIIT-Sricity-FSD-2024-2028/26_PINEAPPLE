import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { RoleContext } from "../context/RoleContext";
import { leaderboardApi } from "../services/leaderboardApi";
import "./leaderboard.css";

const periods = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "alltime", label: "All time" },
];

const rankMark = (rank) => {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank;
};

function Leaderboard() {
  const { user } = useContext(AuthContext) || {};
  const { currentRole } = useContext(RoleContext) || {};
  const [period, setPeriod] = useState("weekly");
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
        const result = await leaderboardApi.getLeaderboard({ period }, currentRole);
        if (isCurrentRequest) {
          setEntries(Array.isArray(result) ? result : []);
        }
      } catch (requestError) {
        if (isCurrentRequest) {
          setError(requestError.message || "Unable to load the leaderboard.");
          setEntries([]);
        }
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    loadLeaderboard();
    return () => {
      isCurrentRequest = false;
    };
  }, [period, currentRole, retryCount]);

  const currentUserId = user?.id || localStorage.getItem("teamforge.backendUserId");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredEntries = entries.filter((entry) =>
    `${entry.user || ""} ${entry.initials || ""}`.toLocaleLowerCase().includes(normalizedQuery),
  );

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
        <div className="leaderboard-controls">
          <div className="leaderboard-periods" role="tablist" aria-label="Leaderboard period">
            {periods.map((item) => (
              <button
                key={item.id}
                id={`leaderboard-tab-${item.id}`}
                className={`leaderboard-period${period === item.id ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={period === item.id}
                aria-controls="leaderboard-results"
                onClick={() => setPeriod(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="leaderboard-search">
            <span className="leaderboard-visually-hidden">Search contributors</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search contributors"
            />
          </label>
        </div>
        <span className="leaderboard-period-note">
          {period === "alltime" ? "All recorded XP" : `${period[0].toUpperCase()}${period.slice(1)} XP`}
        </span>
      </div>

      <div
        className="leaderboard-table-wrap"
        id="leaderboard-results"
        role="tabpanel"
        aria-labelledby={`leaderboard-tab-${period}`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="leaderboard-message" role="status">Loading rankings...</div>
        ) : error ? (
          <div className="leaderboard-message leaderboard-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-message">No rankings to show for this period yet.</div>
        ) : filteredEntries.length === 0 ? (
          <div className="leaderboard-message">No contributors match: {searchQuery.trim()}</div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Contributor</th>
                <th scope="col" className="numeric-column">XP</th>
                <th scope="col" className="numeric-column">Reputation</th>
                <th scope="col" className="numeric-column">Tasks</th>
                <th scope="col" className="numeric-column">Projects</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => {
                const rank = Number(entry.rank) || index + 1;
                const isCurrentUser = currentUserId && String(entry.userId) === String(currentUserId);
                const name = entry.user || "Unknown contributor";
                const initials = entry.initials || name
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr key={entry.userId || `${name}-${rank}`} className={isCurrentUser ? "is-current-user" : ""}>
                    <td className="leaderboard-rank">{rankMark(rank)}</td>
                    <td>
                      <div className="leaderboard-person">
                        <span className={`leaderboard-avatar rank-${rank <= 3 ? rank : "other"}`} aria-hidden="true">
                          {initials}
                        </span>
                        <span className="leaderboard-person-name">
                          {name}
                          {isCurrentUser && <span className="leaderboard-you">You</span>}
                        </span>
                      </div>
                    </td>
                    <td className="numeric-column leaderboard-xp">{Number(entry.xp || 0).toLocaleString()}</td>
                    <td className="numeric-column">{Number(entry.rep || 0).toLocaleString()}</td>
                    <td className="numeric-column">{Number(entry.tasks || 0).toLocaleString()}</td>
                    <td className="numeric-column">{Number(entry.projects || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default Leaderboard;
