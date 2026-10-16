import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import mentorshipApi from '../../services/mentorshipApi';
import usersApi from '../../services/usersApi';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';

const AwardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const CollaboratorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [badges, setBadges] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '2';
        const [uRes, bRes] = await Promise.all([
          usersApi.get(userId).catch(() => null),
          mentorshipApi.getBadges(userId).catch(() => []),
        ]);
        if (isMounted) {
          setUserData(uRes);
          const rawBadges = Array.isArray(bRes) && bRes.length > 0
            ? bRes
            : (Array.isArray(uRes?.data?.mentorRecommendations) ? uRes.data.mentorRecommendations : []);
          setBadges(rawBadges);
        }
      } catch (err) {
        console.error('Failed to load collaborator dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    window.addEventListener('focus', loadData);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', loadData);
    };
  }, [user]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-fg, #6b7280)' }}>
        Loading collaborator dashboard...
      </div>
    );
  }

  const latestBadge = badges.length > 0 ? badges[0] : null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--fg, #111827)' }}>
          Collaborator Dashboard
        </h1>
        <p style={{ color: 'var(--muted-fg, #6b7280)', marginTop: '4px' }}>
          Welcome back, {user?.name || userData?.name || 'Collaborator'}! Track your progress and mentor awards.
        </p>
      </div>

      {latestBadge && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          <span style={{ fontSize: '1.5rem' }}>🏅</span>
          <div style={{ flex: 1, fontSize: '0.95rem', color: 'var(--fg, #111827)' }}>
            <strong>Mentor Recommendation:</strong> You received the{' '}
            <strong style={{ color: '#d97706' }}>{latestBadge.badgeName || latestBadge.badgeType}</strong>{' '}
            badge from Mentor <strong>{latestBadge.mentorName || latestBadge.mentor}</strong> on{' '}
            <em>{latestBadge.projectTitle || latestBadge.project}</em>!
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard
          icon={<AwardIcon />}
          label="Recommendation Badges"
          value={badges.length}
          subtext={latestBadge ? `Latest: ${latestBadge.badgeName || latestBadge.badgeType}` : 'No badges yet'}
        />
        <StatCard
          label="Total XP"
          value={Number(userData?.profile?.xp || 0).toLocaleString()}
          subtext="Contribution points"
        />
        <StatCard
          label="Reputation Score"
          value={Number(userData?.profile?.rep || 0).toLocaleString()}
          subtext="Community trust"
        />
        <StatCard
          label="Tasks Completed"
          value={userData?.profile?.tasksCount || 0}
          subtext="Approved tasks"
        />
      </div>

      <div style={{
        background: 'var(--card, #ffffff)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border, #e5e7eb)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--fg, #111827)' }}>
          Mentor Recommendations {badges.length > 0 && `(${badges.length})`}
        </h3>
        {badges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {badges.map((b, idx) => (
              <div key={b.id || idx} style={{
                padding: '14px 18px',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-alt, #f9fafb)',
                border: '1px solid var(--border, #e5e7eb)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <Badge variant="warning">
                    <AwardIcon /> {b.badgeName || b.badgeType}
                  </Badge>
                  {b.awardedAt && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>
                      {new Date(b.awardedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--fg, #111827)' }}>
                  Given by <strong>{b.mentorName || b.mentor}</strong> on <em>{b.projectTitle || b.project}</em>
                </div>
                {(b.comment || b.note) && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--muted-fg, #4b5563)',
                    fontStyle: 'italic',
                    paddingLeft: '10px',
                    borderLeft: '3px solid #f59e0b',
                  }}>
                    &ldquo;{b.comment || b.note}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted-fg, #6b7280)', fontStyle: 'italic', margin: 0 }}>
            No recommendation badges received yet. Keep contributing to earn recognition from mentors!
          </p>
        )}
      </div>
    </div>
  );
};

export default CollaboratorDashboard;
