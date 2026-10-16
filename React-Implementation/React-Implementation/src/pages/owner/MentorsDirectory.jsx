import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { RoleContext } from '../../context/RoleContext';
import mentorMarketplaceApi, { calculateEscrowBreakdown } from '../../services/mentorMarketplaceApi';
import projectsApi from '../../services/projectsApi';
import { normalizeRole } from '../../services/apiClient';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import MentorCard from '../../components/features/MentorCard';
import './mentorsDirectory.css';

const MentorsDirectory = () => {
  const { user } = useContext(AuthContext);
  const { currentRole } = useContext(RoleContext);
  const navigate = useNavigate();

  const [mentors, setMentors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const [mySessions, setMySessions] = useState([]);

  // Escrow Booking Modal state
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [requestMsg, setRequestMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Non-owners opening Mentors directory must be redirected
  useEffect(() => {
    const role = normalizeRole(currentRole);
    if (role !== 'project-owner' && role !== 'admin' && role !== 'superuser') {
      navigate('/dashboard', { replace: true });
    }
  }, [currentRole, navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadDirectoryData = async () => {
      try {
        const [marketMentors, allProjects, bookedSessions] = await Promise.all([
          mentorMarketplaceApi.listMentors().catch(() => []),
          projectsApi.list().catch(() => []),
          mentorMarketplaceApi.mySessions().catch(() => []),
        ]);

        const validMentors = Array.isArray(marketMentors) ? marketMentors : [];

        if (isMounted) {
          setMentors(validMentors);
          setMySessions(Array.isArray(bookedSessions) ? bookedSessions : []);

          // Only list uncompleted projects owned by caller
          const owned = (Array.isArray(allProjects) ? allProjects : []).filter(
            (p) => {
              const isOwner = p.ownerId === user?.id || p.owner === user?.name;
              const isCompleted = p.isCompleted || String(p.status || '').toLowerCase() === 'completed';
              return isOwner && !isCompleted;
            }
          );
          setOwnedProjects(owned);
          if (owned.length > 0) setSelectedProjectId(owned[0].id);
        }
      } catch (err) {
        console.error('Failed to load mentors directory:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDirectoryData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.name]);

  const handleOpenBooking = (mentor) => {
    setSelectedMentor(mentor);
    setFeedback(null);
    setRequestMsg('');
  };

  // Canonical fee calculation for modal
  const breakdown = calculateEscrowBreakdown(selectedMentor?.sessionPrice || 0);
  const basePrice = breakdown.price;
  const platformFee = breakdown.platformFee;
  const gatewayFee = breakdown.gatewayFee;
  const totalAmount = breakdown.totalAmount;
  const mentorPayout = breakdown.mentorPayout;

  const handleBookSession = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Please select one of your projects to book mentorship for.' });
      return;
    }

    const targetProj = ownedProjects.find((p) => String(p.id) === String(selectedProjectId));
    if (!targetProj) {
      setFeedback({ type: 'error', message: 'You can only book mentors for projects that you own.' });
      return;
    }

    if (targetProj.isCompleted || String(targetProj.status || '').toLowerCase() === 'completed') {
      setFeedback({ type: 'error', message: 'Cannot book mentorship for a completed project.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await mentorMarketplaceApi.bookSession({
        mentorId: selectedMentor.id,
        projectId: selectedProjectId,
        projectDescription: requestMsg.trim() || 'Mentorship booking for project deliverables and architecture review.',
      });

      const updatedSessions = await mentorMarketplaceApi.mySessions().catch(() => []);
      setMySessions(Array.isArray(updatedSessions) ? updatedSessions : []);

      setFeedback({
        type: 'success',
        message: `Mentorship booked! ₹${totalAmount} is secured in escrow. The mentor has been notified.`,
      });

      setTimeout(() => {
        setSelectedMentor(null);
        setFeedback(null);
      }, 1600);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to complete escrow booking. Please check your project selection.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayedMentors = mentors.filter((m) => {
    // Hide mentors with availability off
    if (m.isAvailable === false) return false;
    // Do not list demo mentors without a price
    if (!m.sessionPrice || Number(m.sessionPrice) <= 0) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (m.name || '').toLowerCase();
    const title = (m.title || m.bio || '').toLowerCase();
    const skills = Array.isArray(m.skills) ? m.skills.join(' ').toLowerCase() : '';
    return name.includes(q) || title.includes(q) || skills.includes(q);
  });

  const mentorMap = {};
  mentors.forEach((m) => {
    mentorMap[m.id] = m;
  });

  const historyColumns = [
    {
      key: 'mentor',
      header: 'Mentor',
      render: (s) => {
        const m = mentorMap[s.mentorId];
        return <strong>{m ? m.name : s.mentorName || 'Mentor'}</strong>;
      },
    },
    {
      key: 'project',
      header: 'Project',
      render: (s) => s.projectName || (s.projectId ? `Project #${String(s.projectId).slice(-6)}` : '—'),
    },
    {
      key: 'price',
      header: 'Price',
      render: (s) => <span>₹{(s.agreedPrice || 0).toLocaleString()}</span>,
    },
    {
      key: 'platformFee',
      header: 'Platform Fee (15%)',
      render: (s) => <span className="text-muted">₹{(s.platformFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'gatewayFee',
      header: 'Gateway Fee (2%)',
      render: (s) => <span className="text-muted">₹{(s.gatewayFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Paid',
      render: (s) => <span className="font-bold">₹{(s.totalAmount || 0).toLocaleString()}</span>,
    },
    {
      key: 'payout',
      header: 'Mentor Payout',
      render: (s) => <span className="text-muted">₹{(s.payout || s.agreedPrice || 0).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const map = {
          escrow_funded: ['Escrow Funded', 'warning'],
          active: ['Active', 'success'],
          completed: ['Completed', 'completed'],
          refunded: ['Refunded', 'danger'],
          cancelled: ['Cancelled', 'danger'],
          payout_pending: ['Payout Pending', 'warning'],
        };
        const [label, variant] = map[s.status] || [s.status, 'info'];
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'date',
      header: 'Booked',
      render: (s) => (s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div id="page-mentors" className="tf-mentors-container">
      <div className="tf-mentors-header">
        <h1 className="tf-mentors-title">Mentors Directory</h1>
        <p className="tf-mentors-subtitle">
          Connect with verified mentors with transparent session pricing and secure escrow protection.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <FilterTabs
          tabs={[
            { id: 'browse', label: 'Browse Mentors' },
            { id: 'history', label: 'Booking History', count: mySessions.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'history' ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
            My Mentorship Bookings
          </h2>
          <DataTable
            columns={historyColumns}
            data={[...mySessions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))}
            loading={loading}
            loadingMessage="Loading booking history..."
            emptyTitle="No mentor bookings yet"
            emptyMessage="When you book a mentor for one of your projects, your booking and escrow breakdown will appear here."
            actionLabel="Find a Mentor"
            onAction={() => setActiveTab('browse')}
          />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '24px', maxWidth: '480px' }}>
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search mentors by name or skill..."
            />
          </div>

          {loading ? (
            <p>Loading mentors directory...</p>
          ) : displayedMentors.length === 0 ? (
            <EmptyState
              title="No mentors found"
              message={searchQuery ? `No mentors matching "${searchQuery}". Try a different search term.` : 'No mentors currently available in the marketplace.'}
              actionLabel={searchQuery ? 'Clear Search' : undefined}
              onAction={searchQuery ? () => setSearchQuery('') : undefined}
            />
          ) : (
            <div id="mentors-grid" className="tf-mentors-grid">
              {displayedMentors.map((m) => (
                <MentorCard
                  key={m.id}
                  name={m.name}
                  avatar={m.avatar}
                  headline={m.title || m.bio || 'Verified Mentor'}
                  bio={m.bio}
                  skills={m.skills}
                  experienceYears={m.experienceYears}
                  schedule={m.availability}
                  sessionPrice={m.sessionPrice}
                  available={m.isAvailable !== false}
                  action={{
                    label: m.isAvailable !== false ? 'Book with Escrow' : 'Currently Unavailable',
                    onClick: () => handleOpenBooking(m),
                    disabled: m.isAvailable === false,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Escrow Booking Modal via Reusable Modal */}
      <Modal
        isOpen={Boolean(selectedMentor)}
        title={`Book Mentorship Session: ${selectedMentor?.name || ''}`}
        onClose={() => setSelectedMentor(null)}
        footer={
          <>
            <button
              type="button"
              className="tf-myproj-btn-primary"
              style={{ background: '#9ca3af' }}
              onClick={() => setSelectedMentor(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-mentors-btn-primary"
              style={{ width: 'auto' }}
              disabled={submitting || ownedProjects.length === 0}
              onClick={handleBookSession}
            >
              {submitting ? 'Funding Escrow...' : `Confirm & Pay ₹${totalAmount}`}
            </button>
          </>
        }
      >
        {selectedMentor && (
          <form onSubmit={handleBookSession}>
            <div className="tf-mentors-form-group">
              <label className="tf-mentors-form-label">Select Your Project</label>
              {ownedProjects.length > 0 ? (
                <select
                  className="tf-mentors-input"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                >
                  {ownedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="tf-myproj-card-meta" style={{ color: '#dc2626' }}>
                  You have no active projects eligible for mentorship. Please create an active project first.
                </p>
              )}
            </div>

            <FormInput
              label="Mentorship Needs & Project Goals"
              name="requestMsg"
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
              placeholder="Describe current architecture challenges, code reviews, or guidance needed..."
              multiline
              rows={3}
              helperText="The mentor will review this description before accepting the session."
            />

            {/* Escrow Price Breakdown */}
            <div className="tf-mentors-escrow-breakdown">
              <div className="tf-escrow-breakdown-row">
                <span>Mentor Session Fee</span>
                <span>₹{basePrice}</span>
              </div>
              <div className="tf-escrow-breakdown-row">
                <span>Platform Fee (15%)</span>
                <span>₹{platformFee}</span>
              </div>
              <div className="tf-escrow-breakdown-row">
                <span>Payment Gateway Fee (2%)</span>
                <span>₹{gatewayFee}</span>
              </div>
              <div className="tf-escrow-breakdown-row" style={{ color: '#16a34a', fontWeight: 500 }}>
                <span>Mentor Payout (on completion)</span>
                <span>₹{mentorPayout}</span>
              </div>
              <div className="tf-escrow-breakdown-total">
                <span>Total Escrow Amount</span>
                <span>₹{totalAmount}</span>
              </div>
              <span className="tf-escrow-badge">
                🔒 Escrow Protection: Funds will be held securely. If the mentor declines, you receive a 100% full refund. Payout is released to the mentor only after you complete and publish the project.
              </span>
            </div>

            {feedback && (
              <p
                className="tf-myproj-card-meta"
                style={{
                  color: feedback.type === 'success' ? '#16a34a' : '#ef4444',
                  marginTop: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {feedback.message}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
};

export default MentorsDirectory;
