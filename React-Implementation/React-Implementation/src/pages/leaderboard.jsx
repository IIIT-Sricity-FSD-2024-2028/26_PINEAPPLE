import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { RoleContext } from "../context/RoleContext";
import { leaderboardApi } from "../services/leaderboardApi";
import SearchBar from "../components/common/SearchBar";
import DataTable from "../components/common/DataTable";
import Avatar from "../components/common/Avatar";
import { getTrustLabelConfig, getStandingBandConfig } from "../components/features/UserTrustCard";
import storage from "../utils/storage";
import "./leaderboard.css";

function Leaderboard() {
  const { user } = useContext(AuthContext) || {};
  const { currentRole } = useContext(RoleContext) || {};
  const [activeTab, setActiveTab] = useState("xp"); // 'xp' | 'reliable' | 'standing'
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState("alltime");
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
        const result = await leaderboardApi.getLeaderboard({ period, tab: activeTab }, currentRole);
        if (isCurrentRequest) {
          setEntries(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (isCurrentRequest) {
          setEntries([]);
          setError(err?.message || 'Unable to load leaderboard right now.');
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
  }, [period, activeTab, currentRole, retryCount]);

  const currentUserId = user?.id || storage.getBackendUserId();
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredEntries = entries.filter((entry) =>
    `${entry.user || ""} ${entry.initials || ""}`.toLocaleLowerCase().includes(normalizedQuery),
  );

  const getColumns = () => {
    const contributorCol = {
      header: 'Contributor',
      accessor: 'user',
      sortable: true,
      render: (row) => {
        const isCurrentUser = currentUserId && (String(row.userId) === String(currentUserId) || (user?.email && row.email === user.email));
        const rawName = row.user || "Unknown contributor";
        const cleanName = rawName.replace(/\s*\([^)]*\)$/, '').trim();
        const label = row.trustLabel;
        const labelCfg = label ? getTrustLabelConfig(label) : null;

        return (
          <div className="leaderboard-person" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={cleanName} size="sm" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="leaderboard-person-name" style={{ fontWeight: 600 }}>
                  {cleanName}
                </span>
                {isCurrentUser && <span className="leaderboard-you">You</span>}
              </div>
              {labelCfg && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '8px',
                    background: labelCfg.bg,
                    color: labelCfg.color,
                    border: `1px solid ${labelCfg.border}`,
                    width: 'fit-content',
                  }}
                >
                  <span>{labelCfg.icon}</span>
                  <span>{label}</span>
                </span>
              )}
            </div>
          </div>
        );
      },
    };

    if (activeTab === 'reliable') {
      return [
        contributorCol,
        {
          header: 'On-Time Rate',
          accessor: 'onTimeRate',
          sortable: true,
          align: 'right',
          render: (row) => (
            <span style={{ fontWeight: 700, color: '#059669' }}>
              {row.onTimeRate !== null && row.onTimeRate !== undefined ? `${row.onTimeRate}%` : '—'}
            </span>
          ),
        },
        {
          header: 'Verified Tasks',
          accessor: 'tasks',
          sortable: true,
          align: 'right',
          render: (row) => Number(row.tasks || 0).toLocaleString(),
        },
        {
          header: 'XP',
          accessor: 'xp',
          sortable: true,
          align: 'right',
          render: (row) => (
            <span className="leaderboard-xp">{Number(row.xp || 0).toLocaleString()} XP</span>
          ),
        },
        {
          header: 'Standing',
          accessor: 'band',
          sortable: true,
          align: 'center',
          render: (row) => {
            const band = row.band || 'Good standing';
            const bCfg = getStandingBandConfig(band);
            return (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: bCfg.bg,
                  color: bCfg.color,
                  border: `1px solid ${bCfg.border}`,
                }}
              >
                {band}
              </span>
            );
          },
        },
      ];
    }

    if (activeTab === 'standing') {
      return [
        contributorCol,
        {
          header: 'Standing Band',
          accessor: 'band',
          sortable: true,
          align: 'center',
          render: (row) => {
            const band = row.band || 'Good standing';
            const bCfg = getStandingBandConfig(band);
            return (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: bCfg.bg,
                  color: bCfg.color,
                  border: `1px solid ${bCfg.border}`,
                }}
              >
                {band}
              </span>
            );
          },
        },
        {
          header: 'XP',
          accessor: 'xp',
          sortable: true,
          align: 'right',
          render: (row) => (
            <span className="leaderboard-xp">{Number(row.xp || 0).toLocaleString()} XP</span>
          ),
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
    }

    // Default 'xp' tab
    return [
      contributorCol,
      {
        header: 'XP',
        accessor: 'xp',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="leaderboard-xp">{Number(row.xp || 0).toLocaleString()} XP</span>
        ),
      },
      {
        header: 'Standing',
        accessor: 'band',
        sortable: true,
        align: 'center',
        render: (row) => {
          const band = row.band || 'Good standing';
          const bCfg = getStandingBandConfig(band);
          return (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: bCfg.bg,
                color: bCfg.color,
                border: `1px solid ${bCfg.border}`,
              }}
            >
              {band}
            </span>
          );
        },
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
  };

  return (
    <section className="leaderboard-page" aria-labelledby="leaderboard-title">
      <header className="leaderboard-header">
        <div>
          <p className="leaderboard-eyebrow">COMMUNITY STANDINGS</p>
          <h1 id="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-description">
            See how contributors are building momentum and verified contributions across TeamForge.
          </p>
        </div>
        <div className="leaderboard-total" aria-live="polite">
          <span className="leaderboard-total-value">{filteredEntries.length}</span>
          <span className="leaderboard-total-label">
            {normalizedQuery ? "matches" : "contributors"}
          </span>
        </div>
      </header>

      {/* Leaderboard View Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'xp' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('xp')}
          style={{ padding: '6px 16px', borderRadius: '8px', fontWeight: activeTab === 'xp' ? 600 : 400 }}
        >
          Top by XP
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'reliable' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('reliable')}
          style={{ padding: '6px 16px', borderRadius: '8px', fontWeight: activeTab === 'reliable' ? 600 : 400 }}
        >
          Most Reliable (≥80% on-time)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'standing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('standing')}
          style={{ padding: '6px 16px', borderRadius: '8px', fontWeight: activeTab === 'standing' ? 600 : 400 }}
        >
          Highest Standing
        </button>
      </div>

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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[
              { id: 'alltime', label: 'All-Time' },
              { id: 'monthly', label: 'Monthly (30d)' },
              { id: 'weekly', label: 'Weekly (7d)' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontWeight: period === p.id ? 600 : 400,
                  cursor: 'pointer',
                  border: period === p.id ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-color, #e5e7eb)',
                  background: period === p.id ? 'var(--primary, #2563eb)' : 'transparent',
                  color: period === p.id ? '#ffffff' : 'inherit',
                }}
              >
                {p.label}
              </button>
            ))}
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
            columns={getColumns()}
            data={filteredEntries}
            loading={isLoading}
            tableClassName="leaderboard-table"
            loadingMessage="Loading contributors..."
            emptyMessage={
              entries.length === 0
                ? "No contributors to show yet."
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
