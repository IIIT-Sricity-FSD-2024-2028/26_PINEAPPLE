import { useEffect, useState } from "react";
import "./LandingPage.css";

const links = [
  ["Features", "features"],
  ["Roles", "roles"],
  ["How It Works", "how-it-works"],
  ["Rating System", "rating-system"],
];
const features = [
  [
    "Project-Collaboration.jpg",
    "Project Collaboration",
    "Browse, create, and join real-world projects. Work with teammates across domains - from web development to machine learning.",
  ],
  [
    "Expert-Mentorship.jpg",
    "Expert Mentorship",
    "Apply for mentorship from industry professionals and experienced peers. Get guidance when you need it most.",
  ],
  [
    "Planning_and_Scheduling.jpg",
    "Planning & Scheduling",
    "Project owners create tasks, assign collaborators, and set deadlines as work progresses.",
  ],
  ["XP-System.png", "XP System", "Complete tasks. Earn XP. Prove your skills."],
  [
    "Contribution_Report.jpg",
    "Contribution Report",
    "Detailed reports of your contributions across projects showcase your verified work history.",
  ],
  [
    "Real_time_com.jpg",
    "Real-Time Communication",
    "Integrated chat keeps your team aligned.",
  ],
];
const roles = [
  [
    "01",
    "Collaborator",
    "Join projects, complete tasks, earn ratings, and build your portfolio through verified contributions.",
  ],
  [
    "02",
    "Project Owner",
    "Create projects, assign tasks, manage your team, and approve contributions with full control.",
  ],
  [
    "03",
    "Mentor",
    "Guide students, review progress, issue recommendation badges, and shape the next generation.",
  ],
];
const steps = [
  [
    "01",
    "Create or Join a Project",
    "Sign up and explore available projects or start your own project. Connect with students who want to collaborate.",
  ],
  [
    "02",
    "Get Assigned Tasks",
    "Project owners create and assign tasks with defined difficulty levels and deadlines.",
  ],
  [
    "03",
    "Complete Tasks & Submit Work",
    "Work on tasks using external tools and submit evidence such as pull requests, commits, or documentation links.",
  ],
  [
    "04",
    "Earn XP & Build Reputation",
    "Climb the rankings, earn mentor badges, and build a verified portfolio of contributions.",
  ],
];

function Header({ open, setOpen }) {
  const closeMenu = () => setOpen(false);
  const nav = links.map(([label, id]) => (
    <a
      key={id}
      href={`#${id}`}
      className="header__nav-link"
      onClick={closeMenu}
    >
      {label}
    </a>
  ));
  return (
    <header className="header">
      <div className="header__container">
        <a href="#" className="header__logo">
          <span className="header__logo-icon">TF</span>
          <span className="header__logo-text">TeamForge</span>
        </a>
        <nav className="header__nav">{nav}</nav>
        <div className="header__actions">
          <a href="/log.html" className="header__btn header__btn--primary">
            Sign in
          </a>
          <a
            href="/log.html#signup"
            className="header__btn header__btn--secondary"
          >
            Sign Up
          </a>
          <a href="/?admin=1" className="header__btn header__btn--secondary">
            Admin Portal
          </a>
        </div>
        <button
          className="header__menu-toggle"
          type="button"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      {open && (
        <nav className="header__mobile-nav">
          {nav}
          <div className="header__mobile-actions">
            <a href="/log.html" className="header__btn header__btn--primary">
              Sign in
            </a>
            <a
              href="/log.html#signup"
              className="header__btn header__btn--secondary"
            >
              Sign Up
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Heading({ label, title, children }) {
  return (
    <header className="section-heading">
      <p className="section-label">{label}</p>
      <h2 className="section-title">{title}</h2>
      {children && <p className="section-subtitle">{children}</p>}
    </header>
  );
}

function ScoreCard({ title, items, note }) {
  return (
    <article className="gamification__card">
      <div className="gamification__card-header">
        <div className="gamification__icon-wrap">★</div>
        <h3>{title}</h3>
      </div>
      <div className="gamification__card-body">
        <ul>
          {items.map(([label, value, type]) => (
            <li key={label}>
              <span>{label}</span>
              <strong
                className={type ? `gamification__list-value--${type}` : ""}
              >
                {value}
              </strong>
            </li>
          ))}
        </ul>
        <p className="gamification__card-note">{note}</p>
      </div>
    </article>
  );
}

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="landing-page">
      <Header open={open} setOpen={setOpen} />
      <main>
        <section className="hero">
          <div className="hero__background">
            <video className="hero__bg-vid" playsInline autoPlay muted loop>
              <source src="/Assets/Video Project 9 (2).mp4" type="video/mp4" />
            </video>
            <div className="hero__overlay" />
          </div>
          <div className="hero__content">
            <div className="hero__badge">
              ⚡ Built for Students who build things
            </div>
            <h1 className="hero__title">
              Collaborate. Build.
              <br />
              <span>Earn Recognition.</span>
            </h1>
            <p className="hero__subtitle">
              The platform where students collaborate on real projects, track
              contributions with ratings, and build verified portfolios that
              actually matter.
            </p>
            <div className="hero__actions">
              <a href="/log.html" className="hero__btn hero__btn--primary">
                Start Collaborating <span>→</span>
              </a>
              <a href="/log.html" className="hero__btn hero__btn--secondary">
                Explore Projects
              </a>
            </div>
          </div>
        </section>
        <section className="stats">
          <div className="stats__container">
            <dl className="stats__grid">
              {[
                ["Students", "10K+"],
                ["Projects", "2,500+"],
                ["Tasks Completed", "50K+"],
                ["Mentors", "800+"],
              ].map(([label, value]) => (
                <div className="stats__item" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section className="features" id="features">
          <div className="features__container">
            <Heading label="Features" title="Everything you need to level up">
              From project discovery to verified contributions - one platform to
              build, learn, and grow.
            </Heading>
            <div className="features__grid">
              {features.map(([image, title, description]) => (
                <article className="features__card" key={title}>
                  <div className="features__image-wrapper">
                    <img src={`/Assets/${image}`} alt={`${title} interface`} />
                  </div>
                  <div className="features__content">
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="roles" id="roles">
          <div className="roles__container">
            <Heading label="User Roles" title="One account, three modes">
              Switch seamlessly between collaborator, owner, and mentor - all
              within the same profile.
            </Heading>
            <div className="roles__grid">
              {roles.map(([number, title, description]) => (
                <article className="roles__card" key={title}>
                  <div className="roles__icon-wrap">{number}</div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="process" id="how-it-works">
          <div className="process__container">
            <Heading label="Process" title="How it works" />
            <div className="process__grid">
              {steps.map(([number, title, description]) => (
                <article className="process__card" key={number}>
                  <div className="process__number">{number}</div>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="gamification" id="rating-system">
          <div className="gamification__container">
            <Heading label="Gamification" title="XP & Reputation System">
              Every contribution counts. Earn ratings, build reputation, and
              climb the rankings.
            </Heading>
            <div className="gamification__grid">
              <ScoreCard
                title="XP System Details"
                items={[
                  ["Easy Task", "10"],
                  ["Medium Task", "20"],
                  ["Hard Task", "40"],
                  ["Early Completion Bonus", "5"],
                ]}
                note="Ratings are awarded across effort. Task appraisal is used to increase level in the system."
              />
              <ScoreCard
                title="Reputation"
                items={[
                  ["Task Approved", "+20", "positive"],
                  ["Mentor Badge", "+20", "positive"],
                  ["Revision Required", "-5", "negative"],
                  ["Missed Deadline", "-5", "negative"],
                  ["Leaving Project", "-20", "negative"],
                ]}
                note="30 Days inactive = Reputation × 0.95 decay"
              />
            </div>
          </div>
        </section>
        <section className="cta">
          <div className="cta__container">
            <h2>Ready to start building?</h2>
            <p>
              Join thousands of students who are collaborating on real projects
              and earning verified experience.
            </p>
            <a href="/log.html" className="cta__btn">
              Get Started - It's Free <span>→</span>
            </a>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="footer__container">
          <a href="#" className="footer__logo">
            <span className="footer__logo-icon">TF</span>
            <span>TeamForge</span>
          </a>
          <nav className="footer__nav">
            {links.map(([label, id]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <p>© {new Date().getFullYear()} TeamForge. All rights reserved.</p>
        </div>
      </footer>
      {scrolled && (
        <style>{".header { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }"}</style>
      )}
    </div>
  );
}
