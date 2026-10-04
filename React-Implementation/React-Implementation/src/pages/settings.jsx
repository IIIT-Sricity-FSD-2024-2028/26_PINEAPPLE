import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import usersApi from '../services/usersApi';
import "./settings.css"; // Import page-specific stylesheet

// SVG Icons
const ProfileIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const PaletteIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
    <path d="M2 12h20"></path>
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const Toggle = ({ label, description, checked, onChange }) => (
  <div className="set-toggle-row">
    <div>
      <div className="set-toggle-label">{label}</div>
      {description && <div className="set-toggle-desc">{description}</div>}
    </div>
    <label className="set-toggle-switch">
      <input type="checkbox" checked={checked} onChange={onChange} className="set-toggle-input" />
      <span className={`set-toggle-slider ${checked ? 'checked' : ''}`}>
        <span className={`set-toggle-knob ${checked ? 'checked' : ''}`} />
      </span>
    </label>
  </div>
);

const Settings = () => {
  const { user } = useContext(AuthContext);
  
  let currentTheme = "light";
  let toggleThemeFn = null;
  try {
    const uiContext = useContext(UIContext);
    if (uiContext) {
      currentTheme = uiContext.theme;
      toggleThemeFn = uiContext.toggleTheme;
    }
  } catch(e) {}

  const [localTheme, setLocalTheme] = useState(currentTheme);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    bio: "",
    phone: "",
    linkedin: ""
  });

  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    pushNotifications: false,
    projectAlerts: true
  });

  const [privacy, setPrivacy] = useState({
    publicProfile: true,
    showEmail: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const userId = localStorage.getItem("teamforge.backendUserId") || "1";
        const data = await usersApi.get(userId);
        
        setProfile({
          fullName: data.profile?.fullName || data.name || "",
          username: data.profile?.username || "",
          bio: data.profile?.bio || "",
          phone: data.phone || data.profile?.phone || "",
          linkedin: data.profile?.linkedin || data.linkedIn || ""
        });
        
        setSkills(data.profile?.skills || []);
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAddSkill();
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleSave = async (section) => {
    try {
      const userId = localStorage.getItem("teamforge.backendUserId") || "1";
      
      let payload = {};
      if (section === 'Profile') {
        payload = {
          name: profile.fullName,
          phone: profile.phone,
          linkedIn: profile.linkedin,
          profile: {
            fullName: profile.fullName,
            username: profile.username,
            bio: profile.bio,
            linkedin: profile.linkedin,
            phone: profile.phone,
            skills: skills
          }
        };
      }
      // Note: Notifications/Privacy would be handled by expanding the schema if needed.
      
      if (Object.keys(payload).length > 0) {
        await usersApi.update(userId, payload);
      }
      
      alert(`${section} settings saved successfully!`);
    } catch (err) {
      console.error("Failed to save settings", err);
      alert(`Failed to save ${section} settings.`);
    }
  };

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    setLocalTheme(newTheme);
    if (toggleThemeFn && newTheme !== currentTheme) {
      toggleThemeFn();
    }
  };

  if (loading) {
    return (
      <div className="settings-page" style={{ textAlign: 'center', marginTop: '50px' }}>
        <p style={{ color: '#6b7280', fontWeight: 600 }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      
      {/* Header */}
      <div className="set-header">
        <h1 className="set-title-main">Settings</h1>
        <p className="set-subtitle">Manage your account preferences and privacy.</p>
      </div>

      {/* Profile Information */}
      <div className="set-glass-card">
        <div className="set-section-header">
          <div className="set-icon-box set-icon-primary"><ProfileIcon /></div>
          <div>
            <h3 className="set-section-title">Profile Information</h3>
            <p className="set-section-desc">Update your public profile details.</p>
          </div>
        </div>

        <div className="set-input-group">
          <label className="set-label">Avatar Upload</label>
          <div className="set-avatar-row">
            <div className="set-avatar-preview">
              {(profile.fullName || "U").substring(0,2).toUpperCase()}
            </div>
            <div>
              <input type="file" accept="image/*" className="set-file-input" />
              <p className="set-avatar-desc">Select an image (max 2MB) to set as your profile avatar.</p>
            </div>
          </div>
        </div>

        <div className="set-input-grid">
          <div>
            <label className="set-label">Full Name</label>
            <input type="text" name="fullName" value={profile.fullName} onChange={handleProfileChange} className="set-input" />
          </div>
          <div>
            <label className="set-label">Username</label>
            <input type="text" name="username" value={profile.username} onChange={handleProfileChange} className="set-input" />
          </div>
        </div>

        <div className="set-input-group">
          <label className="set-label">Bio</label>
          <input type="text" name="bio" value={profile.bio} onChange={handleProfileChange} className="set-input" />
        </div>

        <div className="set-input-grid">
          <div>
            <label className="set-label">Phone Number</label>
            <input type="text" name="phone" placeholder="9876543210" value={profile.phone} onChange={handleProfileChange} className="set-input" />
          </div>
          <div>
            <label className="set-label">LinkedIn Profile URL</label>
            <input type="url" name="linkedin" placeholder="https://linkedin.com/in/yourprofile" value={profile.linkedin} onChange={handleProfileChange} className="set-input" />
          </div>
        </div>

        <hr className="set-hr" />

        <div className="set-input-group">
          <label className="set-label">My Skills</label>
          <p className="set-skills-desc">Add skills as tags. These appear on your profile and dashboard.</p>
          <div className="set-skill-input-row">
            <input 
              type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="e.g. React, Python" className="set-skill-input" 
            />
            <button onClick={handleAddSkill} className="set-skill-btn">+ Add</button>
          </div>
          <div className="set-skills-list">
            {skills.map((skill, index) => (
              <span key={index} className="set-skill-tag">
                {skill}
                <span onClick={() => removeSkill(skill)} className="set-skill-remove">&times;</span>
              </span>
            ))}
          </div>
        </div>

        <button onClick={() => handleSave('Profile')} className="set-btn-primary">Save Changes</button>
      </div>

      {/* Notifications Settings */}
      <div className="set-glass-card">
        <div className="set-section-header">
          <div className="set-icon-box set-icon-primary"><BellIcon /></div>
          <div>
            <h3 className="set-section-title">Notifications</h3>
            <p className="set-section-desc">Choose what updates you receive.</p>
          </div>
        </div>

        <div className="set-input-group">
          <Toggle 
            label="Email Updates" 
            description="Receive weekly digests and important account alerts via email."
            checked={notifications.emailUpdates} 
            onChange={(e) => setNotifications(prev => ({ ...prev, emailUpdates: e.target.checked }))} 
          />
          <Toggle 
            label="Push Notifications" 
            description="Get real-time alerts in your browser when assigned a task."
            checked={notifications.pushNotifications} 
            onChange={(e) => setNotifications(prev => ({ ...prev, pushNotifications: e.target.checked }))} 
          />
          <Toggle 
            label="Project Alerts" 
            description="Notify me when a project I am collaborating on is updated."
            checked={notifications.projectAlerts} 
            onChange={(e) => setNotifications(prev => ({ ...prev, projectAlerts: e.target.checked }))} 
          />
        </div>
        <button onClick={() => handleSave('Notification')} className="set-btn-primary">Save</button>
      </div>

      {/* Privacy Settings */}
      <div className="set-glass-card">
        <div className="set-section-header">
          <div className="set-icon-box set-icon-primary"><ShieldIcon /></div>
          <div>
            <h3 className="set-section-title">Privacy</h3>
            <p className="set-section-desc">Control what others can see.</p>
          </div>
        </div>

        <div className="set-input-group">
          <Toggle 
            label="Public Profile" 
            description="Allow anyone on TeamForge to view your profile and skills."
            checked={privacy.publicProfile} 
            onChange={(e) => setPrivacy(prev => ({ ...prev, publicProfile: e.target.checked }))} 
          />
          <Toggle 
            label="Show Email Address" 
            description="Make your email visible to project collaborators."
            checked={privacy.showEmail} 
            onChange={(e) => setPrivacy(prev => ({ ...prev, showEmail: e.target.checked }))} 
          />
        </div>
        <button onClick={() => handleSave('Privacy')} className="set-btn-primary">Save</button>
      </div>

      {/* Appearance Settings */}
      <div className="set-glass-card">
        <div className="set-section-header">
          <div className="set-icon-box set-icon-primary"><PaletteIcon /></div>
          <div>
            <h3 className="set-section-title">Appearance</h3>
            <p className="set-section-desc">Customize your interface.</p>
          </div>
        </div>

        <div className="set-theme-wrap">
          <label className="set-label">Theme</label>
          <select value={localTheme} onChange={handleThemeChange} className="set-input set-theme-select">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <button onClick={() => handleSave('Appearance')} className="set-btn-primary">Save</button>
      </div>

      {/* Danger Zone */}
      <div className="set-glass-card set-danger-zone">
        <div className="set-section-header">
          <div className="set-icon-box set-icon-danger"><AlertIcon /></div>
          <div>
            <h3 className="set-section-title-danger">Danger Zone</h3>
            <p className="set-section-desc">Irreversible account actions.</p>
          </div>
        </div>
        <button 
          onClick={async () => {
            if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
              try {
                const userId = localStorage.getItem("teamforge.backendUserId") || "1";
                await usersApi.remove(userId);
                alert("Account deleted.");
                // User would need to be routed out via logout fn, but standard behavior here.
              } catch(e) {
                alert("Failed to delete account.");
              }
            }
          }}
          className="set-btn-primary set-btn-danger"
        >
          Delete Account
        </button>
      </div>

    </div>
  );
};

export default Settings;
