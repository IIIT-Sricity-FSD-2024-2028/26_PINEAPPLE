import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import './createProject.css';

const CreateProject = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [maxCapacityLimit, setMaxCapacityLimit] = useState(20);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objectives: '',
    skills: '',
    duration: '1 month',
    maxCollaborators: 5,
    difficulty: 'Beginner',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    adminApi.getPublicConfig()
      .then((cfg) => {
        if (cfg?.maxCollaboratorsPerProject) {
          setMaxCapacityLimit(cfg.maxCollaboratorsPerProject);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user begins typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Project title is required.';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters.';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required.';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters.';
    }

    if (Number(formData.maxCollaborators) > maxCapacityLimit) {
      newErrors.maxCollaborators = `Max collaborators cannot exceed platform limit of ${maxCapacityLimit}.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) {
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
          <FormInput
            label="Project Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. AI Campus Navigator"
            error={errors.title}
            required
          />

          <FormInput
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="What is this project about? Describe the mission and target outcomes..."
            multiline
            rows={3}
            error={errors.description}
            required
          />

          <FormInput
            label="Objectives"
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            placeholder="Key milestones and deliverables..."
            multiline
            rows={2}
          />

          <div className="tf-create-proj-grid-2">
            <FormInput
              label="Skills Required (comma-separated)"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="React, Node.js, Python..."
              helperText="Separate multiple skills with commas."
            />

            <FormInput
              label="Est. Duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              options={['1 month', '2 months', '3 months', '6 months']}
            />
          </div>

          <div className="tf-create-proj-grid-2">
            <FormInput
              label="Max Collaborators"
              name="maxCollaborators"
              type="number"
              min="1"
              max={maxCapacityLimit}
              value={formData.maxCollaborators}
              onChange={handleChange}
              error={errors.maxCollaborators}
              helperText={`Platform maximum: ${maxCapacityLimit}`}
            />

            <FormInput
              label="Difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleChange}
              options={['Beginner', 'Intermediate', 'Advanced']}
            />
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
