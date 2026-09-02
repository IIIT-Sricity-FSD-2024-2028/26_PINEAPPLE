# 💰 TeamForge — Revenue Model Ideas

> **Platform:** TeamForge — Student Collaboration, Projects, Teams & Mentorship
> **Stack:** Vanilla JS Frontend + NestJS Backend
> **Existing modules that unlock revenue:** `billing`, `escrow`, `payouts`, `mentorship`, `mentor-applications`, `mentor-requests`, `projects`, `tasks`, `teams`, `organizations`, `gamification`, `leaderboard`, `users`, `uploads`, `sponsorships`

---

## 🎯 Executive Summary

TeamForge already has the infrastructure for most of these revenue streams. The key insight:
- **Hackathons** = one-time event revenue (volatile)
- The models below = **recurring, scalable, high-margin** revenue

---

## 💡 Revenue Model 1 — Premium Mentorship Marketplace

> **Effort:** Medium | **Potential:** ₹3–15L/month | **Backend modules needed:** `mentorship`, `payouts`, `escrow`

### How It Works
- Students pay per session to book 1-on-1 or group sessions with verified mentors
- Mentors set their own hourly/session rate
- TeamForge takes a **15–20% platform commission** on every session
- Free users get 1 free intro session; paid users unlock unlimited bookings

### Pricing Tiers

| Plan | Price | What Student Gets |
|------|-------|-------------------|
| Free | ₹0 | 1 free intro session/month |
| Student Pro | ₹299/month | Up to 5 sessions/month, group workshops |
| Unlimited | ₹699/month | Unlimited sessions, priority matching |

### Mentor Revenue Share

| Tier | Commission | Perks |
|------|-----------|-------|
| Standard | 80% of session fee | Basic listing |
| Verified | 80% + Featured badge | ₹499/month, appears at top of search |
| Expert | 80% + Homepage feature | ₹999/month, custom banner |

### Additional Revenue
- **Group Workshop hosting** — ₹99/student; mentor gets 70%, platform keeps 30%
- **"Verified Mentor" badge** — ₹499/month for mentors wanting featured placement
- **Corporate Mentor Sponsorship** — Companies sponsor expert mentors for ₹25,000/month visibility

### Why It Works for TeamForge
The `escrow` module already holds funds until session is confirmed. The `payouts` module already handles mentor payouts. The `mentor-applications` + `mentor-requests` flow is already built. This needs only a **booking UI + pricing enforcement layer**.

---

## 💡 Revenue Model 2 — Pro Project Workspace Subscriptions

> **Effort:** Low-Medium | **Potential:** ₹5–20L/month (SaaS) | **Backend modules needed:** `billing`, `projects`, `tasks`, `uploads`, `teams`

### How It Works
Free users get a limited workspace. Paying users unlock more projects, team members, storage, and features. Classic **freemium SaaS** — very predictable, recurring revenue.

### Subscription Tiers

| Plan | Price | Projects | Team Members | Storage | Features |
|------|-------|----------|-------------|---------|---------|
| **Free** | ₹0 | 3 | 5 | 50 MB | Basic tasks, public projects |
| **Pro** | ₹199/month | 20 | 20 | 5 GB | GitHub sync, advanced tasks, private repos |
| **Team** | ₹499/month | Unlimited | 100 | 20 GB | Analytics dashboard, custom roles, priority support |
| **College** | ₹2,999/month | Unlimited | 500 | 100 GB | Branded workspace, faculty access, placement tracking |

### Revenue Projection

```
500 Pro users    × ₹199   = ₹99,500/month
200 Team plans   × ₹499   = ₹99,800/month
 20 College plans × ₹2,999 = ₹59,980/month
─────────────────────────────────────────
Total ARR potential          ≈ ₹31L/year
```

### Why It Works for TeamForge
The `billing` module exists. You already track projects, tasks, uploads. This is **plan enforcement** — check the user's plan before allowing creation of project #4, and show an upgrade prompt. Very low technical lift, very high revenue ceiling.

---

## 💡 Revenue Model 3 — Recruiter / Company Hiring Portal

> **Effort:** Medium | **Potential:** ₹10–50L/month | **Backend modules needed:** `users`, `leaderboard`, `projects`, `organizations`, `gamification`

### How It Works
- Companies pay a monthly fee to access a **searchable, ranked talent pool** of students
- Students' public project portfolios, XP scores, leaderboard ranks, and skill tags are visible
- Companies can send direct hire requests, shortlist candidates, and download portfolios
- Students control visibility (opt-in per plan)

### Recruiter Pricing Tiers

| Plan | Price | Access |
|------|-------|--------|
| **Starter** | ₹4,999/month | 50 profile views, basic skill filters, contact unlock |
| **Growth** | ₹9,999/month | 200 views, advanced filters (college, XP, stack), bulk contact |
| **Enterprise** | ₹24,999/month | Unlimited views, team sourcing, API access, dedicated account manager |

### Student Benefits (incentive to join)
- Profile badge: "Open to Opportunities"
- Higher placement in recruiter search = motivation to earn more XP
- Premium students get direct inbound from companies

### Revenue Projection

```
10 Starter companies  × ₹4,999  = ₹49,990/month
 5 Growth companies   × ₹9,999  = ₹49,995/month
 2 Enterprise clients × ₹24,999 = ₹49,998/month
─────────────────────────────────────────────────
Even at small scale               ≈ ₹18L/year
```

### Why It Works for TeamForge
This is exactly how **HackerEarth, HackerRank, and LinkedIn** make most of their money. Your `leaderboard` + `gamification` XP system creates a **natural talent ranking** that companies will pay for. No other student platform in India has this built-in ranking.

---

## 💡 Revenue Model 4 — XP Coin Store & Gamification Monetization

> **Effort:** Low | **Potential:** ₹1–5L/month | **Backend modules needed:** `gamification`, `leaderboard`, `billing`, `escrow`

### How It Works
Students earn XP through activity (free). A parallel **Coin** currency can be purchased and spent on premium benefits.

### Coin Packs (Purchase)

| Pack | Price | Coins |
|------|-------|-------|
| Starter | ₹49 | 100 coins |
| Popular | ₹199 | 500 coins |
| Power | ₹499 | 1,500 coins |
| Mega | ₹999 | 3,500 coins |

### Coin Spends (What They Buy)

| Action | Cost |
|--------|------|
| Boost profile in recruiter search for 7 days | 200 coins |
| Unlock a premium mentor session slot | 150 coins |
| Send a "Super Join Request" to a team (stands out) | 50 coins |
| Gift coins to a teammate as a thank-you | 10+ coins |
| Enter a premium hackathon bracket | 500 coins |
| Get a custom profile badge | 300 coins |

### XP Staking on Hackathons *(unique mechanic)*
- Using the existing `escrow` module, teams can **stake XP** to enter premium hackathon tiers
- Higher stake = higher prize pool bracket
- Losing teams lose staked XP; winners gain a multiplier
- Creates intense engagement and recurring activity

---

## 💡 Revenue Model 5 — Project Portfolio Premium

> **Effort:** Low | **Potential:** ₹1–3L/month | **Backend modules needed:** `projects`, `uploads`, `users`

### How It Works
Every student's projects are on TeamForge. Give them a **public, shareable portfolio** as an upsell.

### Tiers

| Plan | Price | Features |
|------|-------|---------|
| Free | ₹0 | Projects listed internally only |
| Portfolio | ₹99/month | Public URL: `teamforge.io/u/yourname`, shareable |
| Portfolio Pro | ₹249/month | Custom domain, PDF export, recruiter visibility badge, analytics |

### Why Students Pay
- Internship season → everyone wants a shareable portfolio link
- Better than a LinkedIn project section (live demos, team details, task history)
- One link shows everything: projects, XP rank, team contributions

---

## 💡 Revenue Model 6 — College / Institute B2B Partnership Plans

> **Effort:** Medium | **Potential:** ₹15–60L/year | **Backend modules needed:** `organizations`, `projects`, `users`, `leaderboard`

### How It Works
Colleges pay an annual fee for a **white-labelled TeamForge workspace** for all their students. This is a **B2B contract sale** — one deal = thousands of users.

### College Plan Features

| Feature | What It Includes |
|---------|----------------|
| Branded workspace | College logo, custom URL |
| Student onboarding | Bulk import via CSV / college email domain |
| Faculty dashboard | See all student projects, activity |
| Internal leaderboard | College-only rankings |
| Internal mini-hackathons | Faculty can host private hackathons |
| Placement tracking | Track which students got hired and where |
| Analytics | Skill heatmaps, active student reports |

### Pricing

| Package | Price | College Size |
|---------|-------|-------------|
| Starter | ₹9,999/year | Up to 200 students |
| Standard | ₹24,999/year | Up to 1,000 students |
| Premium | ₹49,999/year | Up to 5,000 students |
| University | ₹99,999/year | Unlimited, multi-campus |

### Revenue Projection

```
10 Starter colleges  × ₹9,999  = ₹99,990/year
 5 Standard colleges × ₹24,999 = ₹1,24,995/year
 2 Premium colleges  × ₹49,999 = ₹99,998/year
─────────────────────────────────────────────────
Even at small scale               ≈ ₹3.25L/year
At 50 colleges                    ≈ ₹15–20L/year
```

---

## 🗺️ Recommended Execution Roadmap

### Phase 1 — Quick Wins (Weeks 1–2)
```
✅ Pro Subscription Plans
   → billing module exists
   → just add plan limits + upgrade prompts
   → Immediate recurring revenue

✅ Portfolio Premium
   → projects + uploads already exist
   → Add public URL + paywall
   → Easy upsell to every active user
```

### Phase 2 — Core Revenue (Weeks 3–6)
```
✅ Premium Mentorship Marketplace
   → mentor modules already built
   → Add session booking UI + commission logic
   → Highest per-transaction value

✅ XP Coin Store
   → gamification module exists
   → Add coin purchase + spend mechanics
   → Creates daily engagement loop
```

### Phase 3 — Big Ticket (Month 2–3)
```
✅ Recruiter / Hiring Portal
   → leaderboard + users + projects ready
   → Build company-facing search UI
   → Highest revenue per customer

✅ College B2B Partnerships
   → organizations module exists
   → Sales-driven, needs pitch deck + demo
   → One deal = ₹10,000–₹1,00,000/year
```

---

## 📊 Combined Revenue Potential

| Revenue Stream | Conservative | Optimistic |
|----------------|-------------|-----------|
| Pro Subscriptions | ₹50,000/mo | ₹5,00,000/mo |
| Mentorship Commission | ₹30,000/mo | ₹3,00,000/mo |
| Recruiter Portal | ₹50,000/mo | ₹5,00,000/mo |
| Coin Store | ₹10,000/mo | ₹1,00,000/mo |
| Portfolio Premium | ₹10,000/mo | ₹50,000/mo |
| College B2B | ₹20,000/mo | ₹5,00,000/mo |
| **Total** | **₹1.7L/mo** | **₹19.5L/mo** |

---

## ✅ Key Advantages TeamForge Already Has

| Module | Revenue It Unlocks |
|--------|-------------------|
| `escrow` | Holds funds safely for sessions, hackathons, stakes |
| `payouts` | Distributes earnings to mentors and winners |
| `billing` | Subscription billing infrastructure already exists |
| `leaderboard` + `gamification` | Natural talent ranking — rare in edtech |
| `organizations` | B2B college accounts already modelled |
| `mentor-applications` + `mentor-requests` | Mentor vetting flow already built |
| `sponsorships` | Corporate sponsor integration ready |

> **Bottom line:** TeamForge is **60–70% of the way** to a fully monetized platform.
> The revenue models above don't require rebuilding anything —
> they require **enabling pricing gates and adding transaction UI**
> on top of already-working backend modules.

---

*Document version: 1.0 | Created: September 2026 | TeamForge Revenue Strategy*
