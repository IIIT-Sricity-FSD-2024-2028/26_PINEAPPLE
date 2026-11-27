import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { fetchPublicConfig } from '../../store/thunks/platformConfigThunks';
import {
  createProject as createProjectThunk,
  fetchTaskTemplatesByCategory,
} from '../../store/thunks/projectsThunks';
import {
  clearStarterTemplates,
  setStarterError,
} from '../../store/slices/projectsSlice';
import {
  selectCreateProjectStatus,
  selectProjectsWorking,
} from '../../store/selectors/projectsSelectors';
import { selectPublicConfig } from '../../store/selectors/platformConfigSelectors';
import FormInput from '../../components/common/FormInput';
import DatePicker from '../../components/common/DatePicker';
import StarterTaskPicker from '../../components/features/StarterTaskPicker';
import {
  PROJECT_CATEGORIES,
  STARTER_TASK_CONSTRAINTS,
  formatStarterTaskError,
} from '../../constants/projectCategories';
import './createProject.css';

const CreateProjectContent = () => {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const working = useSelector(selectProjectsWorking);
  const createStatus = useSelector(selectCreateProjectStatus);
  const publicConfig = useSelector(selectPublicConfig);

  const maxCapacityLimit = Number(publicConfig?.maxCollaboratorsPerProject) > 0
    ? Number(publicConfig.maxCollaboratorsPerProject)
    : 20;
  const [minDueDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objectives: '',
    skills: '',
    maxCollaborators: 5,
    difficulty: 'Beginner',
    category: '',
    dueDate: '',
  });

  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Starter Task Templates (templates list/loading/error stored in Redux `working`)
  const starterTemplates = working.starterTemplates || [];
  const resolvedTemplateCategory = working.starterTemplatesCategory || '';
  const loadingTemplates = Boolean(working.loadingTemplates);
  const starterError = working.starterError || '';
  const submitting = createStatus === 'loading';
  const [starterSelectedKeys, setStarterSelectedKeys] = useState([]);
  const [starterOverrides, setStarterOverrides] = useState({});
  const [starterStepSkipped, setStarterStepSkipped] = useState(false);

  useEffect(() => {
    dispatch(fetchPublicConfig()).catch(() => {});
  }, [dispatch]);

  const loadStarterTemplatesForCategory = (selectedCat) => {
    const clean = String(selectedCat || '').trim();
    if (!clean) {
      dispatch(clearStarterTemplates());
      setStarterSelectedKeys([]);
      setStarterOverrides({});
      setStarterStepSkipped(false);
      return;
    }

    setStarterStepSkipped(false);
    dispatch(fetchTaskTemplatesByCategory(clean))
      .unwrap()
      .then((res) => {
        const list = Array.isArray(res?.items) ? res.items : [];
        setStarterSelectedKeys(list.map((item) => item.key));
        setStarterOverrides({});
      })
      .catch(() => {
        setStarterSelectedKeys([]);
      });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user begins typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (name === 'category') {
      loadStarterTemplatesForCategory(value);
    }
  };

  const handleToggleStarterKey = (key) => {
    dispatch(setStarterError(''));
    setStarterSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleToggleAllStarterKeys = (selectableKeys) => {
    dispatch(setStarterError(''));
    const allSelected =
      selectableKeys.length > 0 &&
      selectableKeys.every((k) => starterSelectedKeys.includes(k));
    setStarterSelectedKeys(allSelected ? [] : selectableKeys);
  };

  const handleStarterOverrideChange = (key, nextVal) => {
    dispatch(setStarterError(''));
    setStarterOverrides((prev) => ({
      ...prev,
      [key]: nextVal,
    }));
  };

  const handleSkipStarterTasks = () => {
    setStarterStepSkipped(true);
    setStarterSelectedKeys([]);
    dispatch(setStarterError(''));
  };

  const handleResumeStarterTasks = () => {
    setStarterStepSkipped(false);
    setStarterSelectedKeys(starterTemplates.map((item) => item.key));
    dispatch(setStarterError(''));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Project title is required.';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters.';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required.';
    } else if (formData.description.trim().length < 100) {
      newErrors.description = 'Description must be at least 100 characters.';
    }

    if (Number(formData.maxCollaborators) > maxCapacityLimit) {
      newErrors.maxCollaborators = `Max collaborators cannot exceed platform limit of ${maxCapacityLimit}.`;
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Project due date is required.';
    } else {
      const selected = new Date(formData.dueDate);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (selected < tomorrow) {
        newErrors.dueDate = 'Due date must be at least tomorrow.';
      }
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

    const activeStarterKeys =
      formData.category && !starterStepSkipped ? starterSelectedKeys : [];

    if (activeStarterKeys.length > 0) {
      for (const key of activeStarterKeys) {
        const tpl = starterTemplates.find((t) => t.key === key);
        if (!tpl) continue;
        const ov = starterOverrides[key] || {};
        const title = String(ov.title !== undefined ? ov.title : tpl.title).trim();
        const description = String(ov.description !== undefined ? ov.description : tpl.description).trim();
        if (
          title.length < STARTER_TASK_CONSTRAINTS.minTitleLength ||
          title.length > STARTER_TASK_CONSTRAINTS.maxTitleLength
        ) {
          dispatch(
            setStarterError(
              `Each selected starter task title must be ${STARTER_TASK_CONSTRAINTS.minTitleLength} to ${STARTER_TASK_CONSTRAINTS.maxTitleLength} characters.`,
            ),
          );
          return;
        }
        if (
          description.length < STARTER_TASK_CONSTRAINTS.minDescriptionLength ||
          description.length > STARTER_TASK_CONSTRAINTS.maxDescriptionLength
        ) {
          dispatch(
            setStarterError(
              `Each selected starter task description must be ${STARTER_TASK_CONSTRAINTS.minDescriptionLength} to ${STARTER_TASK_CONSTRAINTS.maxDescriptionLength} characters.`,
            ),
          );
          return;
        }
      }
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        objectives: formData.objectives.trim(),
        requiredSkills: skillsArray,
        dueDate: formData.dueDate,
        maxCollaborators: Number(formData.maxCollaborators) || 5,
        difficulty: formData.difficulty,
        ...(formData.category ? { category: formData.category } : {}),
        ...(activeStarterKeys.length > 0
          ? {
              starterTaskKeys: activeStarterKeys,
              starterTaskOverrides: starterOverrides,
            }
          : {}),
        owner: user?.name || 'Project Owner',
        ownerId: user?.id || '1',
        status: 'Open',
        progress: 0,
        collaborators: [],
      };

      const created = await dispatch(
        createProjectThunk({ payload, role: 'Project Owner', userId: user?.id }),
      ).unwrap();
      const createdStarterCount = Array.isArray(created?.starterTasksCreated)
        ? created.starterTasksCreated.length
        : 0;
      const skippedStarterList = Array.isArray(created?.starterTasksSkipped)
        ? created.starterTasksSkipped
        : [];
      if (skippedStarterList.length > 0) {
        const firstSkip = skippedStarterList[0];
        const skipMsg = formatStarterTaskError(firstSkip?.code, firstSkip?.reason);
        setFeedback({
          type: 'success',
          message: `Project created with ${createdStarterCount} starter task(s). Some starter tasks were skipped: ${skipMsg}`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: createdStarterCount > 0
            ? `Project created with ${createdStarterCount} starter task(s)! Redirecting...`
            : 'Project created successfully! Redirecting...',
        });
      }

      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        if (created?.id) {
          navigate(`/owner/workspace/${created.id}`);
        } else {
          navigate('/my-projects');
        }
      }, 1200);
    } catch (err) {
      const code = err?.code || err?.data?.code;
      const errField = err?.field || err?.data?.field;
      if (code === 'CONTENT_NOT_ALLOWED' && errField) {
        const mappedField = errField === 'requiredSkills' ? 'skills' : errField;
        setErrors((prev) => ({
          ...prev,
          [mappedField]: err.message || 'Contains content that is not allowed.',
        }));
      } else if (code === 'DESCRIPTION_TOO_SHORT') {
        setErrors((prev) => ({ ...prev, description: err.message }));
      } else if (code === 'TITLE_TOO_SHORT') {
        setErrors((prev) => ({ ...prev, title: err.message }));
      } else if (code === 'TASK_LIMIT_REACHED' || code === 'TEMPLATE_TASK_EXISTS') {
        dispatch(setStarterError(formatStarterTaskError(code, err.message)));
      }
      setFeedback({
        type: 'error',
        message: formatStarterTaskError(code, err.message || 'Failed to create project. Please verify all fields.'),
      });
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
            helperText={`${formData.title.trim().length}/5 minimum characters`}
            required
          />

          <FormInput
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="What is this project about? Describe the mission and target outcomes (at least 100 characters)..."
            multiline
            rows={4}
            error={errors.description}
            helperText={`${formData.description.trim().length}/100 minimum characters`}
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
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <DatePicker
              label="Project Due Date"
              required
              value={formData.dueDate}
              onChange={(val) => {
                setFormData((prev) => ({ ...prev, dueDate: val || '' }));
                if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: '' }));
              }}
              minDate={minDueDate}
              error={errors.dueDate}
              placeholder="DD/MM/YYYY"
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

          <FormInput
            label="Project Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            helperText="Choosing a category unlocks optional starter task suggestions to bootstrap your project tasks."
            options={[
              { value: '', label: 'Select a category (optional)...' },
              ...PROJECT_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
            ]}
          />

          {formData.category && (
            <div
              data-testid="create-starter-tasks-section"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: starterStepSkipped ? '6px' : '12px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    Starter tasks (Optional)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Suggested Open & unassigned tasks for {resolvedTemplateCategory || formData.category}. Uncheck any you don&apos;t need or edit text inline.
                  </p>
                </div>

                {!starterStepSkipped ? (
                  <button
                    type="button"
                    data-testid="skip-starter-tasks-btn"
                    onClick={handleSkipStarterTasks}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Skip starter tasks
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="resume-starter-tasks-btn"
                    onClick={handleResumeStarterTasks}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #4f46e5',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Choose starter tasks
                  </button>
                )}
              </div>

              {starterStepSkipped ? (
                <div
                  data-testid="starter-tasks-skipped-note"
                  style={{ fontSize: '0.85rem', color: '#64748b' }}
                >
                  Starter tasks skipped — your project will be created with 0 starter tasks.
                </div>
              ) : (
                <StarterTaskPicker
                  category={resolvedTemplateCategory || formData.category}
                  templates={starterTemplates}
                  loading={loadingTemplates}
                  existingTitles={[]}
                  selectedKeys={starterSelectedKeys}
                  overrides={starterOverrides}
                  onToggleKey={handleToggleStarterKey}
                  onToggleAll={handleToggleAllStarterKeys}
                  onChangeOverride={handleStarterOverrideChange}
                  error={starterError}
                />
              )}
            </div>
          )}

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

const CreateProject = CreateProjectContent;
export default CreateProject;
