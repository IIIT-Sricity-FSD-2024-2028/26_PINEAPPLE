import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const TrophyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
    <path d="M4 4h3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h3"></path>
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const userName = user?.name || "User";

  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState(["React", "Python"]);

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAddSkill();
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>Welcome back, {userName}!</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Card 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
              <LightningIcon />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginBottom: '0.25rem' }}>4 unread updates</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>XP POINTS 2,450</div>
        </div>

        {/* Card 2 */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
              <TrophyIcon />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginBottom: '0.25rem' }}>Top contributor</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>REPUTATION 87</div>
        </div>

        {/* Card 3 */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(95, 81, 63, 0.1)', color: '#5f513f' }}>
              <FolderIcon />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginBottom: '0.25rem' }}>7</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTIVE PROJECTS</div>
        </div>

        {/* Card 4 */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
              <CheckIcon />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginBottom: '0.25rem' }}>0</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>COMPLETED TASKS</div>
        </div>

      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        
        {/* Recent Activity */}
        <div style={{ background: 'rgba(255, 255, 255, 0.6)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 1.5rem 0' }}>Recent Activity</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#fff', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', marginTop: '6px', flexShrink: 0 }}></div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Mentor Request Approved</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Your request for "AI Integration" was approved by mentor Sarah.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#fff', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', marginTop: '6px', flexShrink: 0 }}></div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Invitation Accepted</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>You joined the project "Smart Grocery App".</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: '#fff', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', marginTop: '6px', flexShrink: 0 }}></div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Task Assigned</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>You were assigned "Implement Authentication" in TeamForge.</div>
              </div>
            </div>
          </div>
        </div>

        {/* My Skills */}
        <div style={{ background: 'rgba(255, 255, 255, 0.6)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem 0' }}>My Skills</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Add skills as tags. These appear on your profile and dashboard.</p>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. React, Python" 
              style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
            />
            <button 
              onClick={handleAddSkill}
              style={{ padding: '0.75rem 1.5rem', background: '#5f513f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, width: 'auto', whiteSpace: 'nowrap' }}
            >
              + Add
            </button>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {skills.map((skill, index) => (
              <span key={index} style={{ padding: '6px 14px', background: '#e5e7eb', color: '#374151', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                {skill}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Contribution Table */}
      <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '2rem', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem 0' }}>Contribution History</h3>
        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>User | {user?.email || "arjun.sharma@teamforge.io"}</div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                <th style={{ padding: '0 1rem 1rem 1rem', color: '#6b7280', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project</th>
                <th style={{ padding: '0 1rem 1rem 1rem', color: '#6b7280', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contribution</th>
                <th style={{ padding: '0 1rem 1rem 1rem', color: '#6b7280', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence</th>
                <th style={{ padding: '0 1rem 1rem 1rem', color: '#6b7280', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '1.25rem 1rem', fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>Smart Grocery App</td>
                <td style={{ padding: '1.25rem 1rem', color: '#4b5563', fontSize: '0.95rem' }}>Implemented Auth Flow</td>
                <td style={{ padding: '1.25rem 1rem' }}>
                  <a href="#" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
                    <LinkIcon /> Open workspace
                  </a>
                </td>
                <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>Approved</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '1.25rem 1rem', fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>TeamForge</td>
                <td style={{ padding: '1.25rem 1rem', color: '#4b5563', fontSize: '0.95rem' }}>Dashboard React Migration</td>
                <td style={{ padding: '1.25rem 1rem' }}>
                  <a href="#" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
                    <LinkIcon /> Open workspace
                  </a>
                </td>
                <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>In Review</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
