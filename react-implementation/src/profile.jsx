import { useState } from "react";

export default function ProfilePage({
  user,
  onProfileUpdate,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");

  function handleSubmit(event) {
    event.preventDefault();

    onProfileUpdate({
      name,
      bio,
      initials: name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    });

    setEditing(false);
  }

  return (
    <section className="page active">
      <div className="flex items-center justify-between">
        <div>
          <h1>My Profile</h1>
          <p className="page-subtitle">
            Manage your public profile
          </p>
        </div>

        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Edit Profile"}
        </button>
      </div>

      <div className="card mt-4">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.initials}
          </div>

          <div className="profile-info">
            <div className="profile-name">{user.name}</div>
            <div className="profile-title">{user.title}</div>
            <div className="profile-bio">{user.bio}</div>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label" htmlFor="profile-name">
                Full Name
              </label>
              <input
                id="profile-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="label" htmlFor="profile-bio">
                Bio
              </label>
              <textarea
                id="profile-bio"
                className="input"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>

            <button className="btn btn-primary" type="submit">
              Save Changes
            </button>
          </form>
        ) : (
          <div className="profile-stats">
            <div className="stat-card">
              <div className="stat-value">{user.xp}</div>
              <div className="stat-label">XP Points</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{user.rep}</div>
              <div className="stat-label">Reputation</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{user.projects}</div>
              <div className="stat-label">Projects</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


