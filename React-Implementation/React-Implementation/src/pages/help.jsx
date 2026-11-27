import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import SearchBar from "../components/common/SearchBar";
import { selectCurrentUser } from "../store/selectors/sessionSelectors";
import { searchUsers as searchUsersThunk } from "../store/thunks/profilesThunks";
import {
  createUserReport,
  fetchMyReports as fetchMyReportsThunk,
} from "../store/thunks/reportsThunks";
import { clearReportSubmitFeedback } from "../store/slices/reportsSlice";
import {
  selectMyReports,
  selectMyReportsStatus,
  selectReportsWorking,
} from "../store/selectors/reportsSelectors";
import {
  createSupportTicket,
  fetchMySupportTicketById,
  fetchMySupportTickets,
  replyToMySupportTicket,
} from "../store/thunks/supportTicketsThunks";
import { selectMyTicket } from "../store/slices/supportTicketsSlice";
import {
  selectMySupportTickets,
  selectMyTicketsStatus,
  selectSelectedMyTicket,
  selectSupportTicketsWorking,
} from "../store/selectors/supportTicketsSelectors";
import { highlightMatch } from "../utils/highlightMatch";
import VerifyEmailBanner from "../components/common/VerifyEmailBanner";
import { formatDateTime } from "../utils/dateFormatter";
import "./help.css";

// --- SVGs ---
const RocketIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
    <path d="M12 15l-3-3a22 22 0 0 1-1.26-3c1.34-5.3 6.64-8.08 9.5-8 1 7.23-2.7 11.23-8 12.76z"></path>
    <circle cx="15.5" cy="8.5" r="1.5"></circle>
  </svg>
);

const XPIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const MentorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const TrophyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
    <path d="M4 4h3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h3"></path>
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const FlagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
    <line x1="4" y1="22" x2="4" y2="15"></line>
  </svg>
);

// --- Allowed Report Reasons ---
const REPORT_REASONS = [
  "Harassment",
  "Spam",
  "Cheating or plagiarism",
  "Fake proof",
  "Abandoned work",
  "Inappropriate content",
  "Other",
];

// --- Data ---
const FAQS = [
  {
    category: "Getting Started",
    icon: <RocketIcon />,
    items: [
      {
        q: "How do I create a project?",
        a: "Switch your role to 'Project Owner' from the role switcher in the header. Then navigate to 'Create Project' in the sidebar, fill in your project details including title, description, objectives, skills required, and due date, and submit.",
      },
      {
        q: "How do I apply to join a project?",
        a: "Browse available projects from the 'Projects' section. Click on any project to view details, then click 'Apply to Join Project'. The project owner will review your application and notify you of the decision.",
      },
      {
        q: "Can I be both an owner and a collaborator?",
        a: "Yes! You can own some projects and collaborate in others simultaneously. Additionally, within your own project you can enable the 'Also work as collaborator' toggle to take on and complete tasks yourself.",
      },
    ],
  },
  {
    category: "XP & Reputation",
    icon: <XPIcon />,
    items: [
      {
        q: "How do I earn XP?",
        a: "XP is earned when your submitted tasks are approved by the project owner. Low tasks give 10 XP (+8 Rep), Medium tasks 20 XP (+8 Rep), and High tasks 40 XP (+8 Rep). XP and reputation are awarded strictly upon approval.",
      },
      {
        q: "What is the Reputation Score?",
        a: "Reputation measures your reliability and trustworthiness on the platform. It increases (+8) when tasks are approved, and decreases when tasks need revision (-3), deadlines are missed (-5), or you leave a project midway (-20).",
      },
      {
        q: "Can my XP decrease?",
        a: "No — XP only ever increases once earned. However, your Reputation Score can go up or down based on your behavior and contributions.",
      },
    ],
  },
  {
    category: "Mentors",
    icon: <MentorIcon />,
    items: [
      {
        q: "How do I request a mentor for my project?",
        a: "In your project workspace, click 'Request Mentor'. You can browse available approved mentors and send them a request. Once accepted, their status updates in real-time.",
      },
      {
        q: "How do I become a mentor?",
        a: "Navigate to 'Mentor Application' and submit your LinkedIn profile link. Administrators review applications based on professional experience (4-5+ years in a relevant field).",
      },
      {
        q: "What can mentors do?",
        a: "Mentors provide guidance, answer technical questions, suggest improvements, and issue recommendation badges to collaborators. Mentors cannot approve tasks, assign XP, or modify scores.",
      },
    ],
  },
  {
    category: "Leaderboard & Profile",
    icon: <TrophyIcon />,
    items: [
      {
        q: "How is the leaderboard ranked?",
        a: "Rankings are determined strictly by total XP earned through approved tasks. Weekly, Monthly, and All-Time leaderboards are available. Only approved tasks count.",
      },
      {
        q: "Can I view other users' profiles?",
        a: "Yes — click on any user's name in the Leaderboard to view their public profile, including their skills, projects, badges, XP, and reputation.",
      },
      {
        q: "How do I hide myself from the leaderboard?",
        a: "Go to Settings -> Privacy and toggle off 'Appear on Leaderboard'. This removes you from public rankings while your XP and contributions continue to accumulate.",
      },
    ],
  },
];

// --- Subcomponent: FAQ Category ---
const FaqCategory = ({ category }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="help-glass-card">
      <div className="help-card-title">
        <div className="help-icon-box">{category.icon}</div>
        {category.category}
      </div>
      <div>
        {category.items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="help-faq-item">
              <button className="help-faq-q" onClick={() => toggleFaq(index)}>
                {item.q}
                <span className={`help-chevron ${isOpen ? "open" : ""}`}>
                  <ChevronDownIcon />
                </span>
              </button>
              <div className={`help-faq-a ${isOpen ? "open" : ""}`}>
                {item.a}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Help Component ---
const HelpContent = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const location = useLocation();
  const searchKey = location?.search || "";
  const tabFromSearch = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    const tabParam = params.get("tab");
    const ticketParam = params.get("ticket");
    if (tabParam === "my-reports" || tabParam === "reports" || tabParam === "myreports") return "my-reports";
    if (tabParam === "report") return "report";
    if (tabParam === "tickets" || ticketParam) return "tickets";
    return null;
  }, [searchKey]);
  const [tabOverride, setTabOverride] = useState({ search: searchKey, tab: null });
  const activeTab =
    tabOverride.search === searchKey && tabOverride.tab
      ? tabOverride.tab
      : tabFromSearch || "support"; // "support" | "tickets" | "report" | "my-reports"
  const setActiveTab = useCallback(
    (tab) => setTabOverride({ search: searchKey, tab }),
    [searchKey],
  );
  const [faqSearch, setFaqSearch] = useState("");

  // My Tickets & New Ticket state (backed by supportTicketsSlice)
  const myTickets = useSelector(selectMySupportTickets);
  const myTicketsStatus = useSelector(selectMyTicketsStatus);
  const ticketsLoading = myTicketsStatus === "loading";
  const ticketsError = useSelector((s) => s?.supportTickets?.myTicketsError || "");
  const selectedTicket = useSelector(selectSelectedMyTicket);
  const supportWorking = useSelector(selectSupportTicketsWorking);
  const ticketDetailLoading = Boolean(supportWorking.myTicketDetailLoading);

  const [ticketCategory, setTicketCategory] = useState("Help Inquiry");
  const [ticketPriority, setTicketPriority] = useState("normal");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [parentTicket, setParentTicket] = useState(null);
  const ticketSubmitting = Boolean(supportWorking.ticketSubmitting);
  const ticketSubmitError = supportWorking.ticketSubmitError || "";
  const ticketSubmitSuccess = supportWorking.ticketSubmitSuccess || "";

  const [myReplyBody, setMyReplyBody] = useState("");
  const sendingMyReply = Boolean(supportWorking.sendingMyReply);
  const myReplyError = supportWorking.myReplyError || "";

  // Report form & My Reports state (backed by reportsSlice + local keystrokes)
  const reportsWorking = useSelector(selectReportsWorking);
  const myReports = useSelector(selectMyReports);
  const myReportsStatus = useSelector(selectMyReportsStatus);
  const loadingReports = myReportsStatus === "loading";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [localReportError, setLocalReportError] = useState("");
  const submitting = Boolean(reportsWorking.submitSubmitting);
  const errorMessage = localReportError || reportsWorking.submitError || "";
  const successMessage = reportsWorking.submitSuccess || "";
  const emailNotVerifiedError = Boolean(reportsWorking.emailNotVerified);

  const searchDebounceRef = useRef(null);
  const comboboxRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch my reports when switching to report tab
  const fetchMyReports = useCallback(() => {
    return dispatch(fetchMyReportsThunk());
  }, [dispatch]);

  useEffect(() => {
    if (activeTab === "report" || activeTab === "my-reports") {
      fetchMyReports();
    }
  }, [activeTab, fetchMyReports]);

  const fetchMyTickets = useCallback(() => {
    return dispatch(fetchMySupportTickets());
  }, [dispatch]);

  const openMyTicketDetail = useCallback(
    (ticketId) => {
      return dispatch(fetchMySupportTicketById(ticketId));
    },
    [dispatch],
  );

  useEffect(() => {
    if (activeTab === "tickets") {
      dispatch(fetchMySupportTickets());
    }
  }, [activeTab, dispatch]);

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const ticketParam = params.get("ticket");
    if (ticketParam) {
      dispatch(fetchMySupportTicketById(ticketParam));
    }
  }, [searchKey, dispatch]);

  const handleSubmitNewTicket = async (e) => {
    e.preventDefault();
    const s = ticketSubject.trim();
    const m = ticketMessage.trim();
    if (s.length < 5 || s.length > 120 || m.length < 10 || m.length > 2000) return;

    try {
      await dispatch(
        createSupportTicket({
          type: "help",
          category: ticketCategory,
          priority: ticketPriority,
          subject: s,
          message: m,
          ...(parentTicket?.id ? { parentTicketId: parentTicket.id } : {}),
        }),
      ).unwrap();
      setTicketSubject("");
      setTicketMessage("");
      setParentTicket(null);
    } catch {
      // Error stored in supportTicketsSlice working.ticketSubmitError
    }
  };

  const handleSendMyReply = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !myReplyBody.trim()) return;
    try {
      await dispatch(
        replyToMySupportTicket({
          ticketId: selectedTicket.id,
          body: myReplyBody.trim(),
        }),
      ).unwrap();
      setMyReplyBody("");
    } catch {
      // Friendly TICKET_CLOSED or error stored in supportTicketsSlice working.myReplyError
    }
  };

  // Debounced search for users (min 2 chars, never returns email)
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setLocalReportError("");
    dispatch(clearReportSubmitFeedback());

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await dispatch(searchUsersThunk(val.trim())).unwrap();
        const rawList = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        // Filter out current user from search results (cannot report self)
        const list = rawList.filter((u) => {
          if (!currentUser?.id && !currentUser?.email) return true;
          const matchId = currentUser?.id && String(u.id) === String(currentUser.id);
          const matchUsername =
            currentUser?.username &&
            u.username &&
            String(u.username).toLowerCase() === String(currentUser.username).toLowerCase();
          return !matchId && !matchUsername;
        });
        setSearchResults(list);
        setDropdownOpen(true);
      } catch (err) {
        console.warn("User search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);
    setDropdownOpen(false);
    setLocalReportError("");
    dispatch(clearReportSubmitFeedback());
  };

  const handleClearSelectedUser = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setSearchResults([]);
    setDropdownOpen(false);
  };

  const isSelf = Boolean(
    currentUser?.id && selectedUser?.id && String(selectedUser.id) === String(currentUser.id)
  );

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!selectedUser || !reason || details.trim().length < 20 || details.length > 1000) {
      return;
    }

    if (isSelf) {
      setLocalReportError("You cannot report yourself.");
      return;
    }

    setLocalReportError("");
    try {
      await dispatch(
        createUserReport({
          reportedUserId: selectedUser.id,
          reason,
          details: details.trim(),
        }),
      ).unwrap();
      setSelectedUser(null);
      setReason("");
      setDetails("");
      setSearchQuery("");
    } catch {
      // Friendly error & emailNotVerified stored in reportsSlice working state
    }
  };

  // Filtered FAQs
  const filteredFaqs = FAQS.map((cat) => {
    if (!faqSearch.trim()) return cat;
    const q = faqSearch.toLowerCase();
    const matchingItems = cat.items.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
    return matchingItems.length > 0 ? { ...cat, items: matchingItems } : null;
  }).filter(Boolean);

  const isFormValid =
    Boolean(selectedUser) &&
    !isSelf &&
    Boolean(reason) &&
    details.trim().length >= 20 &&
    details.length <= 1000 &&
    !submitting;

  return (
    <div className="help-page">
      {/* Header */}
      <div className="help-header">
        <h1 className="help-title-main">Help & Support</h1>
        <p className="help-subtitle">Find answers, reach out to us, or report platform violations.</p>
      </div>

      {/* Tabs */}
      <div className="help-tabs-header">
        <button
          className={`help-tab-button ${activeTab === "support" ? "active" : ""}`}
          onClick={() => setActiveTab("support")}
          data-testid="tab-contact"
        >
          Contact Support & FAQs
        </button>
        <button
          className={`help-tab-button ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
          data-testid="tab-tickets"
        >
          My Tickets
        </button>
        <button
          className={`help-tab-button ${activeTab === "report" ? "active" : ""}`}
          onClick={() => setActiveTab("report")}
          data-testid="tab-report"
        >
          Report a User
        </button>
        <button
          className={`help-tab-button ${activeTab === "my-reports" ? "active" : ""}`}
          onClick={() => setActiveTab("my-reports")}
          data-testid="tab-my-reports"
        >
          My reports
        </button>
      </div>

      {activeTab === "support" ? (
        <>
          <div style={{ marginBottom: "2rem", maxWidth: "500px" }}>
            <SearchBar
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              onClear={() => setFaqSearch("")}
              placeholder="Search FAQs and help topics..."
            />
          </div>

          {/* FAQ Sections */}
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((cat, index) => (
              <FaqCategory key={index} category={cat} />
            ))
          ) : (
            <p style={{ color: "#6b7280" }}>No FAQs match "{faqSearch}".</p>
          )}

          {/* Support Contact & Direct Ticket Link */}
          <div className="help-glass-card" style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div className="help-icon-box"><MailIcon /></div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700 }}>Still have questions?</h4>
                <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.88rem" }}>
                  Open a support ticket directly or reach our team at{" "}
                  <a href="mailto:support@teamforge.edu" style={{ color: "#5f513f", fontWeight: 600 }}>
                    support@teamforge.edu
                  </a>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="help-btn-primary"
              data-testid="open-my-tickets-link"
              onClick={() => setActiveTab("tickets")}
            >
              Open a Ticket / My Tickets
            </button>
          </div>
        </>
      ) : activeTab === "tickets" ? (
        <div data-testid="my-tickets-section">
          {/* New Ticket Form */}
          <div className="help-glass-card">
            <div className="help-card-title">
              <div className="help-icon-box"><MailIcon /></div>
              New Support Ticket
            </div>
            <p style={{ fontSize: "0.9rem", color: "#6b7280", marginTop: "-0.4rem", marginBottom: "1.2rem" }}>
              Submit an inquiry to platform support. You can open up to 5 tickets per day.
            </p>

            {parentTicket && (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.86rem",
                }}
              >
                <span>
                  Follow-up linked to closed ticket: <strong>{parentTicket.subject}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setParentTicket(null)}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontWeight: 600 }}
                >
                  Clear
                </button>
              </div>
            )}

            {ticketSubmitSuccess && (
              <div className="help-banner-success" data-testid="ticket-success" role="alert">
                {ticketSubmitSuccess}
              </div>
            )}
            {ticketSubmitError && (
              <div className="help-banner-error" data-testid="ticket-error" role="alert">
                {ticketSubmitError}
              </div>
            )}

            <form onSubmit={handleSubmitNewTicket} data-testid="new-ticket-form">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "1rem" }}>
                <div>
                  <label className="help-label" htmlFor="ticket-category-select">Category</label>
                  <select
                    id="ticket-category-select"
                    className="help-input"
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                  >
                    <option value="Help Inquiry">Help Inquiry</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Account Issue">Account Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="help-label" htmlFor="ticket-priority-select">Priority</label>
                  <select
                    id="ticket-priority-select"
                    className="help-input"
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="help-input-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                  <label className="help-label" htmlFor="ticket-subject-input" style={{ margin: 0 }}>
                    Subject * (5–120 chars)
                  </label>
                  <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                    {ticketSubject.trim().length} / 120
                  </span>
                </div>
                <input
                  id="ticket-subject-input"
                  data-testid="ticket-subject-input"
                  type="text"
                  className="help-input"
                  maxLength={120}
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Briefly describe your question or issue..."
                />
              </div>

              <div className="help-input-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                  <label className="help-label" htmlFor="ticket-message-input" style={{ margin: 0 }}>
                    Message * (10–2000 chars)
                  </label>
                  <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                    {ticketMessage.trim().length} / 2000
                  </span>
                </div>
                <textarea
                  id="ticket-message-input"
                  data-testid="ticket-message-input"
                  className="help-input help-textarea"
                  maxLength={2000}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Provide detailed information so our support team can assist you..."
                />
              </div>

              <button
                type="submit"
                className="help-btn-primary"
                data-testid="submit-ticket-btn"
                disabled={
                  ticketSubmitting ||
                  ticketSubject.trim().length < 5 ||
                  ticketSubject.trim().length > 120 ||
                  ticketMessage.trim().length < 10 ||
                  ticketMessage.trim().length > 2000
                }
              >
                {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </div>

          {/* My Tickets List & Detail */}
          <div className="help-glass-card" style={{ marginTop: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>My Support Tickets</h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={fetchMyTickets}
                disabled={ticketsLoading}
              >
                Refresh
              </button>
            </div>

            {ticketsError && (
              <div className="help-banner-error" role="alert">
                {ticketsError}
              </div>
            )}

            {ticketsLoading ? (
              <p style={{ color: "#6b7280" }}>Loading your tickets...</p>
            ) : myTickets.length === 0 ? (
              <p style={{ color: "#6b7280" }}>You have not submitted any support tickets yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="help-reports-table" data-testid="my-tickets-list">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.map((t) => (
                      <tr key={t.id} data-testid={`my-ticket-row-${t.id}`}>
                        <td><strong>{t.subject}</strong></td>
                        <td>{t.type === "project_closure" ? "Closure Request" : "Help"}</td>
                        <td style={{ textTransform: "capitalize" }}>{t.priority || "normal"}</td>
                        <td style={{ textTransform: "capitalize" }}>{String(t.status || "open").replace("_", " ")}</td>
                        <td style={{ color: "#6b7280" }}>{formatDateTime(t.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline"
                            data-testid={`view-my-ticket-${t.id}`}
                            onClick={() => openMyTicketDetail(t.id)}
                          >
                            View Thread
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ticketDetailLoading && (
              <p style={{ color: "#6b7280", marginTop: "1rem" }}>Loading ticket thread...</p>
            )}

            {selectedTicket && !ticketDetailLoading && (
              <div
                data-testid="my-ticket-detail"
                style={{
                  marginTop: "1.5rem",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{selectedTicket.subject}</h4>
                    <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px" }}>
                      Status: <strong>{String(selectedTicket.status || "open").replace("_", " ")}</strong> · Priority: {selectedTicket.priority}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => dispatch(selectMyTicket(null))}
                  >
                    Close Detail
                  </button>
                </div>

                <p style={{ margin: "10px 0", whiteSpace: "pre-wrap", fontSize: "0.92rem" }}>
                  {selectedTicket.message}
                </p>

                {selectedTicket.resolutionNote && (
                  <div
                    data-testid="my-ticket-resolution-note"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: selectedTicket.status === "rejected" ? "#fef2f2" : "#ecfdf5",
                      border: `1px solid ${selectedTicket.status === "rejected" ? "#fecaca" : "#a7f3d0"}`,
                      marginBottom: "12px",
                      fontSize: "0.88rem",
                    }}
                  >
                    <strong>Resolution Note:</strong> {selectedTicket.resolutionNote}
                  </div>
                )}

                <div data-testid="my-ticket-replies" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                  {(selectedTicket.replies || []).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: r.authorRole === "admin" ? "#eff6ff" : "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "2px" }}>
                        <strong>{r.authorName}</strong> · {formatDateTime(r.createdAt)}
                      </div>
                      <div style={{ fontSize: "0.88rem", whiteSpace: "pre-wrap" }}>{r.body}</div>
                    </div>
                  ))}
                </div>

                {["resolved", "rejected"].includes(selectedTicket.status) ? (
                  <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      This ticket is {selectedTicket.status} and cannot receive further replies.
                    </span>
                    <button
                      type="button"
                      className="help-btn-primary"
                      data-testid="open-followup-ticket-btn"
                      onClick={() => {
                        setParentTicket(selectedTicket);
                        setTicketSubject(`Follow-up: ${selectedTicket.subject}`.slice(0, 120));
                      }}
                    >
                      Open Follow-Up Ticket
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMyReply} style={{ marginTop: "12px" }}>
                    {myReplyError && (
                      <div className="help-banner-error" role="alert" style={{ marginBottom: "8px" }}>
                        {myReplyError}
                      </div>
                    )}
                    <textarea
                      data-testid="my-ticket-reply-input"
                      rows={2}
                      className="help-input"
                      maxLength={2000}
                      value={myReplyBody}
                      onChange={(e) => setMyReplyBody(e.target.value)}
                      placeholder="Write a reply (1–2000 chars)..."
                    />
                    <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="submit"
                        className="help-btn-primary"
                        data-testid="send-my-reply-btn"
                        disabled={sendingMyReply || !myReplyBody.trim()}
                      >
                        {sendingMyReply ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "report" ? (
        <div>
          {/* Report User Form Card */}
          <div className="help-glass-card">
            <div className="help-card-title">
              <div className="help-icon-box"><FlagIcon /></div>
              Report a User
            </div>
            <p style={{ fontSize: "0.92rem", color: "var(--muted-fg, #6b7280)", marginTop: "-0.5rem", marginBottom: "1.5rem" }}>
              Help us maintain a respectful community. All reports are confidential; the reported user will never see your identity.
            </p>

            {successMessage && (
              <div className="help-banner-success" data-testid="report-success" role="alert">
                {successMessage}
              </div>
            )}

            {emailNotVerifiedError && <VerifyEmailBanner forceShow />}

            {errorMessage && (
              <div className="help-banner-error" data-testid="report-error" role="alert">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmitReport}>
              {/* User Selector Combobox */}
              <div className="help-input-group" ref={comboboxRef}>
                <label className="help-label" htmlFor="user-search-input">
                  User to Report *
                </label>
                {selectedUser ? (
                  <div className="help-selected-user-box" data-testid="selected-user-box">
                    <div>
                      <strong style={{ color: "#111827", fontSize: "0.95rem" }}>{selectedUser.name}</strong>
                      <span style={{ color: "#6b7280", marginLeft: "8px", fontSize: "0.88rem" }}>
                        @{selectedUser.username}
                      </span>
                      {selectedUser.university && (
                        <span style={{ color: "#9ca3af", marginLeft: "8px", fontSize: "0.82rem" }}>
                          · {selectedUser.university}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelectedUser}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#dc2626",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      ✕ Change
                    </button>
                  </div>
                ) : (
                  <div className="help-combobox-wrapper">
                    <input
                      id="user-search-input"
                      data-testid="user-search-input"
                      type="text"
                      className="help-input"
                      placeholder="Type name or @username to search (min 2 letters)..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onFocus={() => {
                        if (searchResults.length > 0) setDropdownOpen(true);
                      }}
                      autoComplete="off"
                    />
                    {isSearching && (
                      <span style={{ position: "absolute", right: "12px", top: "12px", fontSize: "0.82rem", color: "#6b7280" }}>
                        Searching...
                      </span>
                    )}
                    {dropdownOpen && (
                      <div className="help-search-results-dropdown" data-testid="user-search-results">
                        {searchResults.length === 0 ? (
                          <div style={{ padding: "0.75rem 1rem", color: "#9ca3af", fontSize: "0.88rem" }}>
                            {searchQuery.trim().length >= 2 ? "No users found" : "Type at least 2 characters"}
                          </div>
                        ) : (
                          searchResults.map((u) => (
                            <div
                              key={u.id}
                              className="help-search-result-item"
                              data-testid={`search-result-${u.id}`}
                              onClick={() => handleSelectUser(u)}
                            >
                              <div style={{ fontWeight: 600, color: "#111827" }}>{highlightMatch(u.name, searchQuery)}</div>
                              <div style={{ fontSize: "0.82rem", color: "#6b7280", display: "flex", gap: "8px" }}>
                                <span>@{highlightMatch(u.username, searchQuery)}</span>
                                {u.university && <span>· {u.university}</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reason Selector */}
              <div className="help-input-group">
                <label className="help-label" htmlFor="report-reason">
                  Reason for Report *
                </label>
                <select
                  id="report-reason"
                  data-testid="reason-select"
                  className="help-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select a reason...</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Details Textarea */}
              <div className="help-input-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                  <label className="help-label" htmlFor="report-details" style={{ margin: 0 }}>
                    Details & Context *
                  </label>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: details.length > 0 && details.length < 20 ? "#d97706" : details.length > 1000 ? "#dc2626" : "#6b7280",
                    }}
                  >
                    {details.length} / 1000 characters (min. 20)
                  </span>
                </div>
                <textarea
                  id="report-details"
                  data-testid="details-textarea"
                  className="help-input help-textarea"
                  placeholder="Provide specific details about the behavior, incident, or project context (20 to 1,000 characters)..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                />
              </div>

              <button
                type="submit"
                className="help-btn-primary"
                data-testid="submit-report-btn"
                disabled={!isFormValid}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </form>
          </div>

          {/* My Reports List */}
          <div className="help-glass-card" style={{ marginTop: "2rem" }}>
            <div className="help-card-title">
              <div className="help-icon-box">📋</div>
              My reports
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--muted-fg, #6b7280)", marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
              Track the status and outcome of reports you have submitted.
            </p>

            {loadingReports ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading reports...</p>
            ) : myReports.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>You have not submitted any reports.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="help-reports-table" data-testid="my-reports-list">
                  <thead>
                    <tr>
                      <th>Reported User</th>
                      <th>Reason</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myReports.map((r) => {
                      const isChat = r.type === "chat_message";
                      const displayStatus =
                        r.status === "Open" ? "Received" : (r.status || "Received");
                      const statusClass =
                        displayStatus === "Open" || displayStatus === "Received"
                          ? "help-status-open"
                          : displayStatus === "Under review"
                          ? "help-status-under-review"
                          : displayStatus === "Resolved"
                          ? "help-status-resolved"
                          : "help-status-dismissed";

                      return (
                        <tr key={r.id} data-testid={`my-report-row-${r.id}`}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <strong>{r.reportedUserName || "User"}</strong>
                              {isChat && (
                                <span
                                  data-testid={`my-report-chat-badge-${r.id}`}
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "#ede9fe",
                                    color: "#5b21b6",
                                  }}
                                >
                                  Chat message
                                </span>
                              )}
                            </div>
                            {r.reportedUserUsername && (
                              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                @{r.reportedUserUsername}
                              </div>
                            )}
                            {(r.projectName || r.projectId) && (
                              <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "2px" }}>
                                Project: {r.projectName || r.projectId}
                              </div>
                            )}
                          </td>
                          <td>{r.reason}</td>
                          <td style={{ color: "#6b7280" }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                          </td>
                          <td>
                            <span className={`help-status-badge ${statusClass}`} data-testid={`my-report-status-${r.id}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td style={{ color: "#4b5563", fontStyle: r.outcome ? "normal" : "italic" }}>
                            {r.outcome || "Pending review"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "my-reports" ? (
        <div className="help-section-container" data-testid="my-reports-section">
          <div className="help-glass-card">
            <div className="help-card-title">
              <div className="help-icon-box">📋</div>
              My reports
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--muted-fg, #6b7280)", marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
              Track the status and outcome of reports you have submitted.
            </p>

            {loadingReports ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading reports...</p>
            ) : myReports.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>You have not submitted any reports.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="help-reports-table" data-testid="my-reports-list-standalone">
                  <thead>
                    <tr>
                      <th>Reported User</th>
                      <th>Reason</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myReports.map((r) => {
                      const isChat = r.type === "chat_message";
                      const displayStatus =
                        r.status === "Open" ? "Received" : (r.status || "Received");
                      const statusClass =
                        displayStatus === "Open" || displayStatus === "Received"
                          ? "help-status-open"
                          : displayStatus === "Under review"
                          ? "help-status-under-review"
                          : displayStatus === "Resolved"
                          ? "help-status-resolved"
                          : "help-status-dismissed";

                      return (
                        <tr key={r.id} data-testid={`standalone-my-report-row-${r.id}`}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <strong>{r.reportedUserName || "User"}</strong>
                              {isChat && (
                                <span
                                  data-testid={`standalone-my-report-chat-badge-${r.id}`}
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "#ede9fe",
                                    color: "#5b21b6",
                                  }}
                                >
                                  Chat message
                                </span>
                              )}
                            </div>
                            {r.reportedUserUsername && (
                              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                @{r.reportedUserUsername}
                              </div>
                            )}
                            {(r.projectName || r.projectId) && (
                              <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "2px" }}>
                                Project: {r.projectName || r.projectId}
                              </div>
                            )}
                          </td>
                          <td>{r.reason}</td>
                          <td style={{ color: "#6b7280" }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                          </td>
                          <td>
                            <span className={`help-status-badge ${statusClass}`} data-testid={`standalone-my-report-status-${r.id}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td style={{ color: "#4b5563", fontStyle: r.outcome ? "normal" : "italic" }}>
                            {r.outcome || "Pending review"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Help = HelpContent;
export default Help;
