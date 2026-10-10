import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import usersApi from '../services/usersApi';
import "./profile.css";

// --- SVGs ---
const BadgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="prof-badge-icon">
    <path d="M12 15.2l-3.5 2.1 1-4-3.1-2.6 4.1-.3L12 6.7l1.5 3.7 4.1.3-3.1 2.6 1 4z" />
    <path d="M21 11a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const XPIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const RepIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
    <path d="M4 4h3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h3"></path>
  </svg>
);

const ProjectsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const TasksIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="prof-link-icon">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

// --- Component ---
const Profile = () => {
  const { user } = useContext(AuthContext);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = localStorage.getItem("teamforge.backendUserId") || "1";
        
        // Fetch dynamic user data from backend
        const data = await usersApi.get(userId);

        setProfileData({
          name: user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || "User",
          bio: data.profile?.bio || user?.profile?.bio || user?.bio || "No bio available.",
          avatarUrl: user?.avatarUrl || user?.profile?.avatarUrl || data.profile?.avatarUrl || data.avatarUrl || null,
          initials: (user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || "US").substring(0, 2).toUpperCase(),
          hasMentorBadge: data.profile?.mentorUnlocked || false,
          
          title: data.profile?.title || "Team Member",
          uni: data.profile?.uni || "Unknown Organization",
          joined: data.profile?.joined || "Unknown Date",

          stats: {
            xp: data.profile?.xp || 0,
            rep: data.profile?.rep || 0,
            projects: data.data?.projects?.length || 0,
            tasks: data.profile?.tasksCount || 0
          },
          skills: data.profile?.skills || user?.profile?.skills || [],
          
          activeProjects: (data.data?.projects || []).filter(p => p.status !== 'Completed'),
          completedProjects: (data.data?.projects || []).filter(p => p.status === 'Completed'),

          mentorRecommendations: data.data?.mentorRecommendations || [],
          mentoredProjects: data.data?.mentoredProjects || []
        });

      } catch (error) {
        console.error("Failed to fetch profile from API. Are you sure the NestJS backend is running?", error);
        
        // Bare-minimum fallback so the page doesn't fatally crash if backend is down
        setProfileData({
          name: user?.name || user?.profile?.fullName || "Offline User",
          title: "Developer",
          uni: "Offline",
          joined: "N/A",
          bio: "Cannot connect to the backend database.",
          initials: (user?.name || user?.profile?.fullName || "OU").substring(0, 2).toUpperCase(),
          hasMentorBadge: false,
          stats: { xp: 0, rep: 0, projects: 0, tasks: 0 },
          activeProjects: [],
          skills: [],
          completedProjects: [],
          mentorRecommendations: [],
          mentoredProjects: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="profile-page" style={{ textAlign: 'center', marginTop: '50px' }}>
        <p style={{ color: '#6b7280', fontWeight: 600 }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      
      {/* Header Profile Card */}
      <div className="prof-glass-card">
        <div className="prof-header-wrap">
          {/* Avatar */}
          <div className="prof-avatar-lg">
            {profileData.avatarUrl ? (
              <img
                src={profileData.avatarUrl.startsWith('http') || profileData.avatarUrl.startsWith('data:') || profileData.avatarUrl.startsWith('blob:') ? profileData.avatarUrl : `http://localhost:3000${profileData.avatarUrl}`}
                alt={profileData.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              profileData.initials
            )}
          </div>
          
          {/* Info */}
          <div className="prof-info-col">
            <div className="prof-name-row">
              <h1 className="prof-name">{profileData.name}</h1>
              {profileData.hasMentorBadge && (
                <span className="prof-mentor-badge">
                  <BadgeIcon /> Mentor Recommended
                </span>
              )}
            </div>
            <div className="prof-title-text">
              {profileData.title} &middot; {profileData.uni}
            </div>
            <div className="prof-joined-text">
              Member since {profileData.joined}
            </div>
            <p className="prof-bio-text">
              {profileData.bio}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="prof-stats-grid">
          <div className="prof-stat-pill">
            <div className="prof-icon-xp"><XPIcon /></div>
            <div>
              <div className="prof-stat-label">XP</div>
              <div className="prof-stat-val">{profileData.stats.xp.toLocaleString()}</div>
            </div>
          </div>
          <div className="prof-stat-pill">
            <div className="prof-icon-rep"><RepIcon /></div>
            <div>
              <div className="prof-stat-label">Reputation</div>
              <div className="prof-stat-val">{profileData.stats.rep}</div>
            </div>
          </div>
          <div className="prof-stat-pill">
            <div className="prof-icon-proj"><ProjectsIcon /></div>
            <div>
              <div className="prof-stat-label">Projects</div>
              <div className="prof-stat-val">{profileData.stats.projects}</div>
            </div>
          </div>
          <div className="prof-stat-pill">
            <div className="prof-icon-tasks"><TasksIcon /></div>
            <div>
              <div className="prof-stat-label">Tasks</div>
              <div className="prof-stat-val">{profileData.stats.tasks}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Active Projects & Skills */}
      <div className="prof-grid-400">
        
        {/* Active Projects */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Active Projects</h3>
          {profileData.activeProjects.length ? profileData.activeProjects.map((proj, idx) => (
            <div key={idx} className="prof-proj-row">
              <div className="prof-proj-title">{proj.name}</div>
              <div className="prof-proj-desc">{proj.role || "Member"} &middot; {proj.contribution || "Contributor"}</div>
            </div>
          )) : <div className="prof-empty-state">No active projects.</div>}
        </div>

        {/* Skills */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Skills</h3>
          <div className="prof-skills-container">
            {profileData.skills.length ? profileData.skills.map((skill, idx) => (
              <span key={idx} className="prof-skill-tag">
                {skill}
              </span>
            )) : <div className="prof-empty-state">No skills added yet.</div>}
          </div>
        </div>

      </div>

      {/* Row 3: Completed Projects & Mentor Recommendations */}
      <div className="prof-grid-400">
        
        {/* Completed Projects */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Completed Projects</h3>
          {profileData.completedProjects.length ? profileData.completedProjects.map((proj, idx) => (
            <div key={idx} className="prof-proj-row prof-proj-row-flex">
              <div>
                <div className="prof-proj-title">{proj.name}</div>
                <div className="prof-proj-desc">{proj.role || "Member"} &middot; {proj.contribution || "Contributor"}</div>
              </div>
              {proj.finalLink && (
                <a href={proj.finalLink} className="prof-link">
                  Final Link <LinkIcon />
                </a>
              )}
            </div>
          )) : <div className="prof-empty-state">No completed projects available.</div>}
        </div>

        {/* Mentor Recommendations */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Mentor Recommendations</h3>
          {profileData.mentorRecommendations.length ? profileData.mentorRecommendations.map((rec, idx) => (
            <div key={idx} className="prof-proj-row">
              <div className="prof-proj-title">{rec.project}</div>
              <div className="prof-proj-desc">Recommended by {rec.mentor} &middot; "{rec.note}"</div>
            </div>
          )) : <div className="prof-empty-state">No recommendation badges yet.</div>}
        </div>

      </div>

      {/* Row 4: Mentored Projects */}
      <div className="prof-glass-card">
        <h3 className="prof-sub-title">Mentored Projects</h3>
        {profileData.mentoredProjects.length ? profileData.mentoredProjects.map((proj, idx) => (
          <div key={idx} className="prof-proj-row">
            <div className="prof-proj-title">{proj.name}</div>
            <div className="prof-proj-desc">Owner: {proj.owner} &middot; {proj.status}</div>
            <div className="prof-proj-meta">{proj.contribution}</div>
          </div>
        )) : <div className="prof-empty-state">No mentored projects yet.</div>}
      </div>

    </div>
  );
};

export default Profile;
