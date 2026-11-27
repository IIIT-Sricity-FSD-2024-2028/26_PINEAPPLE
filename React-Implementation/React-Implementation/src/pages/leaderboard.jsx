import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectActiveRole, selectCurrentUser } from "../store/selectors/sessionSelectors";
import { setLeaderboardFilters } from "../store/slices/gamificationSlice";
import { fetchLeaderboard } from "../store/thunks/gamificationThunks";
import {
  selectGamificationError,
  selectGamificationStatus,
  selectGamificationWorking,
  selectLeaderboardEntries,
  selectLeaderboardForTab,
} from "../store/selectors/gamificationSelectors";
import SearchBar from "../components/common/SearchBar";
import DataTable from "../components/common/DataTable";
import Avatar from "../components/common/Avatar";
import { getTrustLabelConfig, getStandingBandConfig } from "../utils/trustConfig";
import "./leaderboard.css";

function LeaderboardContent() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const currentRole = useSelector(selectActiveRole);

  const working = useSelector(selectGamificationWorking);
  const activeTab = working.activeTab || "xp";
  const period = working.period || "alltime";
  const searchQuery = working.searchQuery || "";

  const rawEntries = useSelector(selectLeaderboardEntries);
  const filteredEntries = useSelector(selectLeaderboardForTab);
  const status = useSelector(selectGamificationStatus);
  const errorObj = useSelector(selectGamificationError);
  const isLoading = status === "loading";
  const error = errorObj?.message || "";
  const [retryCount, setRetryCount] = useState(0);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const loadLeaderboard = () => {
      dispatch(fetchLeaderboard({ period, tab: activeTabRef.current, role: currentRole }));
    };

    loadLeaderboard();

    const handleUpdate = () => {
      loadLeaderboard();
    };
    window.addEventListener("focus", handleUpdate);

    return () => {
      window.removeEventListener("focus", handleUpdate);
    };
  }, [dispatch, period, currentRole, retryCount]);

  const currentUserId = user?.id || user?.uid || "";
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

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
            <Avatar name={cleanName} src={row.avatarUrl || row.avatar} version={row.updatedAt} size="sm" />
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
          onClick={() => dispatch(setLeaderboardFilters({ activeTab: 'xp' }))}
          style={{ padding: '6px 16px', borderRadius: '8px', fontWeight: activeTab === 'xp' ? 600 : 400 }}
        >
          Top by XP
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'reliable' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => dispatch(setLeaderboardFilters({ activeTab: 'reliable' }))}
          style={{ padding: '6px 16px', borderRadius: '8px', fontWeight: activeTab === 'reliable' ? 600 : 400 }}
        >
          Most Reliable (≥80% on-time)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'standing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => dispatch(setLeaderboardFilters({ activeTab: 'standing' }))}
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
              onChange={(e) => dispatch(setLeaderboardFilters({ searchQuery: e.target.value }))}
              onClear={() => dispatch(setLeaderboardFilters({ searchQuery: '' }))}
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
                onClick={() => dispatch(setLeaderboardFilters({ period: p.id }))}
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
              rawEntries.length === 0
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

const Leaderboard = LeaderboardContent;

export default Leaderboard;
