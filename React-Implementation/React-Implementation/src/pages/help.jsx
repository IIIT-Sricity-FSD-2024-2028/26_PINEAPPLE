import { useState } from "react";
import "./help.css"; // Import page-specific stylesheet

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

// --- Data ---
const FAQS = [
  {
    category: "Getting Started",
    icon: <RocketIcon />,
    items: [
      {
        q: "How do I create a project?",
        a: "Switch your role to 'Project Owner' from the role switcher in the header. Then navigate to 'Create Project' in the sidebar, fill in your project details including title, description, objectives, skills required, and estimated duration, and submit.",
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
        a: "XP is earned when your submitted tasks are approved by the project owner. Easy tasks give 10 XP, Medium tasks 20 XP, and Hard tasks 40 XP. You also earn a +5 XP early completion bonus if you submit before the deadline.",
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


// --- Component ---
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


const Help = () => {

  return (
    <div className="help-page">
      
      {/* Header */}
      <div className="help-header">
        <h1 className="help-title-main">Help & Support</h1>
        <p className="help-subtitle">Find answers or reach out to us.</p>
      </div>

      {/* FAQ Sections */}
      {FAQS.map((cat, index) => (
        <FaqCategory key={index} category={cat} />
      ))}
    </div>
  );
};

export default Help;
