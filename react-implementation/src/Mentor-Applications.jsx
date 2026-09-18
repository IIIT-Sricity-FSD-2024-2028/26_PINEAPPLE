import { useState } from 'react';
import './AdminMentorApplication.css';


const MENTOR_APPLICATIONS = [
  {
    id: 'mentor-app-1',
    name: 'Arjun Sharma',
    initials: 'AS',
    university: 'IIT Delhi',
    submittedAt: 'Mar 6, 2026',
    expertise: 'Full-stack Development, React, Node.js',
    specialization: 'Full-stack Development',
    linkedin: 'https://linkedin.com/in/arjunsharma',
    years: 5,
    motivation:
      'I want to help students navigate the challenges I faced early in my career, especially around building real production systems from scratch.',
    status: 'pending',
  },
  {
    id: 'mentor-app-2',
    name: 'Kavya Menon',
    initials: 'KM',
    university: 'NIT Surathkal',
    submittedAt: 'Mar 5, 2026',
    expertise: 'Data Science, Python, MLOps',
    specialization: 'Data Science',
    linkedin: 'https://linkedin.com/in/kavyamenon',
    years: 6,
    motivation:
      'I enjoy mentoring junior developers and helping them build confidence with practical projects, especially in data-driven products.',
    status: 'approved',
  },
  {
    id: 'mentor-app-3',
    name: 'Harsh Verma',
    initials: 'HV',
    university: 'IIIT Hyderabad',
    submittedAt: 'Mar 4, 2026',
    expertise: 'DevOps, Cloud Architecture, Kubernetes',
    specialization: 'DevOps & Cloud',
    linkedin: 'https://linkedin.com/in/harshverma',
    years: 3,
    motivation:
      'I want to guide teams on deployment and CI/CD. I can support projects with infrastructure and platform reliability best practices.',
    status: 'rejected',
  },
  {
    id: 'mentor-app-4',
    name: 'Meera Pillai',
    initials: 'MP',
    university: 'NIT Calicut',
    submittedAt: 'Mar 8, 2026',
    expertise: 'Backend Engineering, PostgreSQL, System Design',
    specialization: 'Backend Engineering',
    linkedin: 'https://linkedin.com/in/meerapillai',
    years: 7,
    motivation:
      'I want to mentor students on building reliable backend systems and help them learn how to ship production-ready APIs and services.',
    status: 'pending',
  },
  {
    id: 'mentor-app-5',
    name: 'Ritwik Saha',
    initials: 'RS',
    university: 'IIT Kharagpur',
    submittedAt: 'Mar 7, 2026',
    expertise: 'Frontend Architecture, React, Accessibility',
    specialization: 'Frontend Engineering',
    linkedin: 'https://linkedin.com/in/ritwiksaha',
    years: 4,
    motivation:
      'I enjoy helping teams improve UI architecture, accessibility, and code quality. I want to mentor contributors through real project reviews.',
    status: 'approved',
  },
  {
    id: 'mentor-app-6',
    name: 'Nisha Rao',
    initials: 'NR',
    university: 'VIT Vellore',
    submittedAt: 'Mar 9, 2026',
    expertise: 'Data Engineering, Spark, ETL Pipelines',
    specialization: 'Data Engineering',
    linkedin: 'https://linkedin.com/in/nisharao',
    years: 5,
    motivation:
      'I want to support student teams working with analytics and data platforms, and help them build scalable and maintainable data workflows.',
    status: 'pending',
  },
  {
    id: 'mentor-app-7',
    name: 'Siddharth Jain',
    initials: 'SJ',
    university: 'IIIT Delhi',
    submittedAt: 'Mar 2, 2026',
    expertise: 'Cloud Security, IAM, DevSecOps',
    specialization: 'Cloud Security',
    linkedin: 'https://linkedin.com/in/siddharthjain',
    years: 2,
    motivation:
      'I want to mentor on secure development practices and cloud hardening. I am eager to guide teams through practical security checklists.',
    status: 'rejected',
  },
];

const counts = {
  all: MENTOR_APPLICATIONS.length,
  pending: MENTOR_APPLICATIONS.filter((a) => a.status === 'pending').length,
  approved: MENTOR_APPLICATIONS.filter((a) => a.status === 'approved').length,
  rejected: MENTOR_APPLICATIONS.filter((a) => a.status === 'rejected').length,
};

function getStatusBadgeClass(status) {
  if (status === 'approved') return 'status-active';
  if (status === 'rejected') return 'status-rejected';
  return 'status-pending';
}

function toTitleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function AdminMentorApplication() {
  const [filter, setFilter] = useState('pending');

  const filteredApps = filter === 'all'
    ? MENTOR_APPLICATIONS
    : MENTOR_APPLICATIONS.filter((a) => a.status === filter);
  return (
    <div className="admin-mentor-page">
      <h1>Mentor Applications</h1>
      <p className="page-subtitle mt-1">Review and approve mentor applications</p>

      <div className="card mt-4">
        <div className="admin-mentor-criteria">
          <div className="admin-mentor-criteria-title">Eligibility Criteria</div>
          <div className="admin-mentor-criteria-tags">
            <span className="admin-mentor-criteria-tag">
              <span className="admin-mentor-icon">✓</span>
              Min. 4-5 years professional experience
            </span>
            <span className="admin-mentor-criteria-tag">
              <span className="admin-mentor-icon">✓</span>
              Complete &amp; authentic LinkedIn profile
            </span>
            <span className="admin-mentor-criteria-tag">
              <span className="admin-mentor-icon">✓</span>
              Consistent relevant career history
            </span>
            <span className="admin-mentor-criteria-tag">
              <span className="admin-mentor-icon">✓</span>
              Professional conduct - no misconduct record
            </span>
          </div>
        </div>

        <div className="admin-mentor-filters mt-3">
          <button className={`admin-users-filter-chip${filter === 'pending' ? ' active' : ''}`} onClick={() => setFilter('pending')}>
            Pending ({counts.pending})
          </button>
          <button className={`admin-users-filter-chip${filter === 'approved' ? ' active' : ''}`} onClick={() => setFilter('approved')}>
            Approved ({counts.approved})
          </button>
          <button className={`admin-users-filter-chip${filter === 'rejected' ? ' active' : ''}`} onClick={() => setFilter('rejected')}>
            Rejected ({counts.rejected})
          </button>
          <button className={`admin-users-filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
            All ({counts.all})
          </button>
        </div>

        <div className="admin-mentor-list-wrap mt-3">
          {filteredApps.length === 0 ? (
            <div className="admin-users-empty">No mentor applications in this status.</div>
          ) : filteredApps.map((app) => {
            const meetsCriteria = app.years >= 4;
            const statusText = toTitleCase(app.status);
            const statusClass = getStatusBadgeClass(app.status);

            return (
              <div
                key={app.id}
                className={`admin-mentor-card ${app.status === 'pending' ? 'pending' : ''}`}
              >
                <button className="admin-mentor-head">
                  <div className="admin-mentor-left">
                    <div className="admin-mentor-avatar">{app.initials}</div>
                    <div>
                      <div className="admin-mentor-name">{app.name}</div>
                      <div className="admin-mentor-sub">
                        {app.university} · Submitted {app.submittedAt}
                      </div>
                    </div>
                  </div>
                  <div className="admin-mentor-right">
                    <div className="admin-mentor-spec">{app.specialization}</div>
                    <span className={`status-badge ${statusClass}`}>{statusText}</span>
                    <span className="admin-mentor-chevron">▲</span>
                  </div>
                </button>

                <div className="admin-mentor-details open">
                  <div className="admin-mentor-grid">
                    <div>
                      <div className="admin-mentor-label">Expertise</div>
                      <div className="admin-mentor-value">{app.expertise}</div>
                    </div>
                    <div>
                      <div className="admin-mentor-label">Experience</div>
                      <div className="admin-mentor-value">
                        {app.years} years
                        <span className={`admin-mentor-criteria-pill ${meetsCriteria ? 'pass' : 'fail'}`}>
                          <span className="admin-mentor-icon">
                            {meetsCriteria ? '✓' : '✕'}
                          </span>
                          {meetsCriteria ? 'Meets criteria' : 'Below criteria'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="admin-mentor-label">LinkedIn</div>
                      <a
                        className="admin-mentor-link"
                        href={app.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Profile ↗
                      </a>
                    </div>
                    <div>
                      <div className="admin-mentor-label">University</div>
                      <div className="admin-mentor-value">{app.university}</div>
                    </div>
                  </div>

                  <div className="admin-mentor-label mt-3">Motivation</div>
                  <blockquote className="admin-mentor-quote">
                    &ldquo;{app.motivation}&rdquo;
                  </blockquote>

                  {app.status === 'pending' && (
                    <div className="admin-mentor-actions mt-3">
                      <button className="btn btn-primary">Approve Application</button>
                      <button className="btn btn-outline">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
