import React from 'react';
import './help.css';
import './theme.css';
import './help.css';


function Help() {
  const FAQS = [
    {
      category: "Getting Started",
      icon: "🚀",
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
      icon: "⭐",
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
      icon: "🎓",
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
      icon: "🏆",
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

  return (
    <div id="page-help" className="page">
      <h1>Help & Support</h1>
      <p className="page-subtitle">Find answers or reach out to us.</p>
      
      <div id="faq-sections">
        {FAQS.map((cat, ci) => (
          <div className="card mt-3" key={ci}>
            <div className="card-title">
              {cat.icon} {cat.category}
            </div>
            <div>
              {cat.items.map((item, ii) => (
                <div className="faq-item" key={ii}>
                  <button className="faq-q">
                    {item.q}
                    <span className="faq-chevron"></span>
                  </button>
                  <div className="faq-a">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-3">
        <div className="card-title">📩 Contact Support</div>
        <div className="input-group">
          <label className="label">Category</label>
          <select id="support-category" className="input">
            <option>Bug Report</option>
            <option>Feature Request</option>
            <option>Account Issue</option>
            <option>Other</option>
          </select>
        </div>
        <div className="input-group">
          <label className="label">Message</label>
          <textarea
            id="support-message"
            className="input"
            rows="4"
            placeholder="Describe your issue..."
          ></textarea>
        </div>
        <button className="btn btn-primary btn-sm">
          Send Message
        </button>
      </div>
    </div>
  );
}

export default Help;


