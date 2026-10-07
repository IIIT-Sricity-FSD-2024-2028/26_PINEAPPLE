import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import './createProject.css';

const CreateProject = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objectives: '',
    skills: '',
    duration: '1 month',
    maxCollaborators: 5,
    difficulty: 'Beginner',
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.title.trim()) {
      setFeedback({ type: 'error', message: 'Project title is required.' });
      return;
    }

    if (!formData.description.trim()) {
      setFeedback({ type: 'error', message: 'Description is required.' });
      return;
    }

    const skillsArray = formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        objectives: formData.objectives.trim(),
        requiredSkills: skillsArray,
        duration: formData.duration,
        maxCollaborators: Number(formData.maxCollaborators) || 5,
        difficulty: formData.difficulty,
        owner: user?.name || 'Project Owner',
        ownerId: user?.id || '1',
        status: 'Open',
        progress: 0,
        collaborators: [],
      };

      const created = await projectsApi.create(payload, 'Project Owner', user?.id);
      setFeedback({ type: 'success', message: 'Project created successfully! Redirecting...' });

      setTimeout(() => {
        if (created?.id) {
          navigate(`/owner/workspace/${created.id}`);
        } else {
          navigate('/my-projects');
        }
      }, 1200);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to create project. Please verify all fields.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="page-create-project" className="tf-create-proj-container">
      <div className="tf-create-proj-header">
        <h1 className="tf-create-proj-title">Create Project</h1>
        <p className="tf-create-proj-subtitle">Start a new project and build your team.</p>
      </div>

      <div className="tf-create-proj-card">
        {feedback && (
          <div
            className={`tf-create-proj-feedback ${
              feedback.type === 'success'
                ? 'tf-create-proj-feedback-success'
                : 'tf-create-proj-feedback-error'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="tf-create-proj-form">
          <div className="tf-create-proj-group">
            <label htmlFor="create-project-title" className="tf-create-proj-label">
              Project Title
            </label>
            <input
              id="create-project-title"
              name="title"
              type="text"
              className="tf-create-proj-input"
              placeholder="e.g. AI Campus Navigator"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="tf-create-proj-group">
            <label htmlFor="create-project-desc" className="tf-create-proj-label">
              Description
            </label>
            <textarea
              id="create-project-desc"
              name="description"
              className="tf-create-proj-input tf-create-proj-textarea"
              rows={3}
              placeholder="What is this project about?"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="tf-create-proj-group">
            <label htmlFor="create-project-objectives" className="tf-create-proj-label">
              Objectives
            </label>
            <textarea
              id="create-project-objectives"
              name="objectives"
              className="tf-create-proj-input tf-create-proj-textarea"
              rows={2}
              placeholder="Key goals and deliverables..."
              value={formData.objectives}
              onChange={handleChange}
            />
          </div>

          <div className="tf-create-proj-grid-2">
            <div className="tf-create-proj-group">
              <label htmlFor="create-project-skills" className="tf-create-proj-label">
                Skills Required (comma-separated)
              </label>
              <input
                id="create-project-skills"
                name="skills"
                type="text"
                className="tf-create-proj-input"
                placeholder="React, Python, Node.js..."
                value={formData.skills}
                onChange={handleChange}
              />
            </div>

            <div className="tf-create-proj-group">
              <label htmlFor="create-project-duration" className="tf-create-proj-label">
                Est. Duration
              </label>
              <select
                id="create-project-duration"
                name="duration"
                className="tf-create-proj-input"
                value={formData.duration}
                onChange={handleChange}
              >
                <option value="1 month">1 month</option>
                <option value="2 months">2 months</option>
                <option value="3 months">3 months</option>
                <option value="6 months">6 months</option>
              </select>
            </div>
          </div>

          <div className="tf-create-proj-grid-2">
            <div className="tf-create-proj-group">
              <label htmlFor="create-project-collaborators" className="tf-create-proj-label">
                Max Collaborators
              </label>
              <input
                id="create-project-collaborators"
                name="maxCollaborators"
                type="number"
                min={1}
                max={20}
                className="tf-create-proj-input"
                value={formData.maxCollaborators}
                onChange={handleChange}
              />
            </div>

            <div className="tf-create-proj-group">
              <label htmlFor="create-project-difficulty" className="tf-create-proj-label">
                Difficulty
              </label>
              <select
                id="create-project-difficulty"
                name="difficulty"
                className="tf-create-proj-input"
                value={formData.difficulty}
                onChange={handleChange}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="tf-create-proj-btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProject;
