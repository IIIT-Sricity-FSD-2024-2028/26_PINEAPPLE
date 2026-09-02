# 🏗️ TeamForge Hackathons - Architecture & System Design

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TeamForge Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────── FRONTEND (Browser) ──────────────────┐    │
│  │                                                          │    │
│  │  teamforge.html                                         │    │
│  │  ├── Navigation Sidebar                                │    │
│  │  │   └── Hackathons Button                             │    │
│  │  └── #hackathons-content                               │    │
│  │      ├── Browse Tab      🔍                             │    │
│  │      ├── My Hackathons   👥                             │    │
│  │      ├── Host Tab        🏢                             │    │
│  │      └── Dashboard       💰                             │    │
│  │                                                          │    │
│  │  hackathons.js (Main Logic)                             │    │
│  │  ├── HACK_STATE (Global State)                          │    │
│  │  ├── DEMO_HACKATHONS (Demo Data - 5 items)             │    │
│  │  ├── PROMOTION_PLANS (Pricing - 3 tiers)               │    │
│  │  └── render* & hack* functions                          │    │
│  │                                                          │    │
│  │  style.css + theme.css                                  │    │
│  │  └── CSS Variables + Responsive Grid                   │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│           │                                          │            │
│           │ API Calls                        Returns JSON         │
│           ▼                                          ▲            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              apiClient.js (API Layer)                   │     │
│  │  ├── hackathonsApi.search()                             │     │
│  │  ├── hackathonsApi.get()                                │     │
│  │  ├── hackathonsApi.create()                             │     │
│  │  ├── hackathonsApi.*                                    │     │
│  │  │                                                       │     │
│  │  ├── promotionsApi.getPlans()                           │     │
│  │  ├── promotionsApi.purchasePromotion()                  │     │
│  │  ├── promotionsApi.getAnalytics()                       │     │
│  │  └── promotionsApi.*                                    │     │
│  │                                                          │     │
│  │  window.hackathonsApi (Global)                          │     │
│  │  window.promotionsApi (Global)                          │     │
│  └──────────────────────────────────────────────────────────┘     │
│           │                                          ▲            │
│           │ HTTP Requests                    HTTP Responses      │
│           ▼                                          │            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │            Backend API (NestJS REST)                    │     │
│  │                                                          │     │
│  │  GET/POST/PATCH /hackathons                             │     │
│  │  ├── hackathons.controller                              │     │
│  │  ├── hackathons.service                                 │     │
│  │  └── hackathon.entity                                   │     │
│  │                                                          │     │
│  │  GET/POST /promotions (NEW)                             │     │
│  │  ├── promotions.controller ✅                           │     │
│  │  ├── promotions.service ✅                              │     │
│  │  ├── promotion.entity ✅                                │     │
│  │  └── promotion.dto ✅                                   │     │
│  │                                                          │     │
│  │  Middleware                                             │     │
│  │  ├── RolesGuard (Permission Control)                    │     │
│  │  ├── SecurityMiddleware                                 │     │
│  │  ├── LoggerMiddleware                                   │     │
│  │  └── SanitizerMiddleware                                │     │
│  │                                                          │     │
│  └──────────────────────────────────────────────────────────┘     │
│           │                                          ▲            │
│           │ SQL Queries                    Result Sets           │
│           ▼                                          │            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              Database (TypeORM/MongoDB)                 │     │
│  │  ├── hackathons (table)                                 │     │
│  │  │   └── id, name, organizer, prize, views, ...        │     │
│  │  │                                                       │     │
│  │  ├── promotions (table) ⏳ To implement                  │     │
│  │  │   └── id, hackathonId, planId, status, ...          │     │
│  │  │                                                       │     │
│  │  ├── promotion_plans (table) ⏳ To implement             │     │
│  │  │   └── id, name, price, duration, features, ...      │     │
│  │  │                                                       │     │
│  │  └── Other tables (users, teams, etc.)                  │     │
│  │                                                          │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. Browse Hackathons Flow

```
User loads page
    ↓
hackathons.js loads
    ↓
HACK_STATE.tab = "browse"
    ↓
renderHackathons() called
    ↓
hackRenderBrowse() called
    ↓
hackathonsApi.search()
    ↓
Try Backend API
    ↓ (On success) ↓ (On failure)
    Return data    Use DEMO_HACKATHONS
    ↓              ↓
Apply filters (mode, date, search)
    ↓
Sort by: featured > sponsored > date
    ↓
Render featured section (sponsored hackathons)
    ↓
Render cards for each hackathon
    ↓
Display in UI
```

### 2. Purchase Promotion Flow

```
Organizer clicks "Get Started" in Host tab
    ↓
hackSetHostStep(2) - Show purchase form
    ↓
Select promotion plan
    ↓
promotionsApi.purchasePromotion({hackathonId, planId, purchasedBy})
    ↓
Backend creates HackathonPromotionEntity
    ↓
Returns: { id, amountPaid, startDate, endDate, status: "Active" }
    ↓
Frontend shows confirmation
    ↓
Promotion active for 7-30 days
    ↓
Hackathon gets visibility boost
    ↓
Views/registrations tracked
    ↓
Dashboard shows analytics
```

### 3. Admin Dashboard Flow

```
Admin user loads page
    ↓
Checks isSuperUser() === true
    ↓
hackSetTab("organizer-dashboard")
    ↓
hackRenderOrganizerDashboard()
    ↓
For each hackathon:
    ├── Count views
    ├── Count registrations
    ├── Check if sponsored (promotion.status === "Active")
    ├── Calculate revenue
    └── Add to performance table
    ↓
Display KPI cards:
    ├── Total Hackathons: 5
    ├── Total Views: 12,450
    ├── Total Registrations: 1,284
    ├── Sponsored Count: 2
    └── Total Revenue: ₹7,999
    ↓
Show performance table with per-hackathon metrics
```

---

## State Management

### HACK_STATE Object

```javascript
HACK_STATE = {
  // Current tab
  tab: "browse" | "mine" | "host" | "organizer-dashboard",
  
  // Search & filters
  searchQuery: "",
  filterMode: "all" | "online" | "offline" | "hybrid",
  filterDate: "all" | "upcoming" | "ongoing",
  
  // Host tab state
  hostStep: 1 | 2 | 3,
  selectedPlan: null,
  
  // UI state
  detailMode: false,
  selectedHackathonId: null,
}
```

**State is global** so all tabs can access it.

---

## Component Hierarchy

```
teamforge.html
└── div#hackathons-content
    ├── Nav Tabs (Browse | My | Host | 💰 Dashboard)
    │
    ├── Browse Tab
    │   ├── Search Bar
    │   ├── Filters (Mode | Date)
    │   ├── Featured Section
    │   │   └── HackathonCard × 2
    │   └── Regular Cards
    │       └── HackathonCard × 3
    │
    ├── My Hackathons Tab
    │   └── Team Registrations (placeholder)
    │
    ├── Host Tab
    │   └── Promotion Plans
    │       ├── PlanCard (Basic)
    │       ├── PlanCard (Featured)
    │       └── PlanCard (Premium)
    │
    └── Dashboard Tab (Admin)
        ├── KPI Cards × 5
        └── Performance Table
            └── HackathonRow × 5
```

---

## API Endpoints

### Hackathons Endpoints (Existing)

```
GET    /hackathons              - Search all hackathons
GET    /hackathons/:id          - Get single hackathon
GET    /hackathons/host/:orgId  - Get org's hackathons
POST   /hackathons              - Create hackathon
POST   /hackathons/:id/register-lead
PATCH  /hackathons/:id/start
PATCH  /hackathons/:id/close
PATCH  /hackathons/:id/:teamId/score
```

### Promotions Endpoints (NEW ✅)

```
GET    /promotions/plans                      - List all plans
POST   /promotions/plans                      - Create plan (admin)
POST   /promotions/purchase                   - Purchase promotion
GET    /promotions/active                     - Get active promotions
GET    /promotions/hackathon/:hackathonId     - Get hackathon's promotion
GET    /promotions/analytics/:promotionId     - Get promotion analytics
GET    /promotions/organizer/:organizerId/summary
```

---

## Module Dependencies

```
app.module.ts
├── CoreModule
├── UsersModule
├── ProjectsModule
├── TasksModule
├── AdminModule
├── ...other modules...
├── HackathonsModule        (Existing)
├── OrganizationsModule
├── EscrowModule
├── TeamsModule
└── PromotionsModule        (NEW ✅)
    ├── promotions.controller
    ├── promotions.service
    └── promotion.entity + *.dto
```

---

## Data Models

### HackathonEntity (Existing)
```typescript
{
  id: string;
  name: string;
  organizer: string;
  description: string;
  mode: "Online" | "Offline" | "Hybrid";
  location: string;
  prizePool: number;
  teamSize: string;
  regDeadline: Date;
  eventDates: string;
  status: "RegistrationOpen" | "Ongoing" | "Closed";
  
  // NEW FIELDS (for revenue model)
  sponsored?: boolean;          // Is this promoted?
  promotionPlan?: string;        // Which plan? (Basic/Featured/Premium)
  views?: number;                // Total page views
  registrations?: number;        // Team registrations
}
```

### PromotionPlanEntity (NEW ✅)
```typescript
{
  id: string;
  name: "Basic Promotion" | "Featured Hackathon" | "Premium Promotion";
  price: number;                 // In INR
  duration: number;              // In days
  features: string[];            // Feature list
  visibilityBoost: "Standard" | "High" | "Maximum";
  estimatedReach: number;        // Estimated students reached
  createdAt: Date;
}
```

### HackathonPromotionEntity (NEW ✅)
```typescript
{
  id: string;
  hackathonId: string;           // Which hackathon?
  planId: string;                // Which promotion plan?
  purchasedBy: string;           // Organizer user ID
  purchasedAt: Date;
  startDate: Date;
  endDate: Date;                 // Auto-calculated from duration
  status: "Active" | "Expired" | "Pending" | "Cancelled";
  amountPaid: number;            // In INR
  viewsDuringPromotion?: number;
  registrationsDuringPromotion?: number;
}
```

---

## User Role Access Matrix

```
┌──────────────────┬──────────┬───────────┬──────────────┐
│ Feature          │ Student  │ Organizer │ Admin/Super  │
├──────────────────┼──────────┼───────────┼──────────────┤
│ Browse           │    ✅    │    ✅     │     ✅       │
│ Search & Filter  │    ✅    │    ✅     │     ✅       │
│ View Details     │    ✅    │    ✅     │     ✅       │
│ My Hackathons    │    ✅    │    ✅     │     ✅       │
│ Host Tab         │    ❌    │    ✅     │     ✅       │
│ Promotion Plans  │    ✅    │    ✅     │     ✅       │
│ Purchase Promo   │    ❌    │    ✅     │     ✅       │
│ Dashboard        │    ❌    │    ⚠️*    │     ✅       │
│ Create Plans     │    ❌    │    ❌     │     ✅       │
│ Analytics        │    ❌    │    ✅     │     ✅       │
└──────────────────┴──────────┴───────────┴──────────────┘

* Organizer sees only their own hackathons' analytics
```

---

## Error Handling Flow

```
Frontend API Call
    ↓
Try Block
    ├─→ Success ─→ Return data ─→ Render UI
    │
    └─→ Error
        ├─→ Check error type
        │   ├─→ Network error ─→ Use demo data
        │   ├─→ API error ─→ Show toast error
        │   └─→ Validation error ─→ Show form error
        │
        └─→ Fallback to DEMO_HACKATHONS
```

---

## Performance Considerations

### Frontend Optimization
- Demo data loaded immediately (no network latency)
- Cards rendered in efficient grid layout
- Search filters applied client-side (fast)
- Detail page loads in modal (no page refresh)
- CSS variables for theming (no duplicate styles)

### Backend Optimization
- RolesGuard caches permission checks
- Service methods return cached data when possible
- No N+1 queries (eager loading)
- Pagination ready (for future >100 hackathons)

### Database Optimization (Future)
- Indexes on hackathonId, userId, status
- Soft delete for promotions (don't hard delete)
- Denormalize views/registrations for fast queries

---

## Security Architecture

### Authentication
- Bearer token in Authorization header
- Verified by RolesGuard middleware

### Authorization
- RolesGuard checks user role
- Endpoints restricted by role
- Organizer sees only own hackathons

### Input Validation
- DTOs validate all inputs
- SanitizerMiddleware removes malicious content
- HTML escaping in frontend

### Protection
- CORS middleware for cross-origin requests
- Rate limiting on sensitive routes
- SQL injection prevention (TypeORM)
- XSS protection (HTML escaping)

---

## Testing Strategy

### Unit Tests (To implement)
- PromotionsService methods
- Filter logic (search, mode, date)
- Calculation functions (ROI, reach)

### Integration Tests (To implement)
- API endpoints with database
- Permission checks with RolesGuard
- Data consistency (promotion dates)

### E2E Tests (To implement)
- Full flow: Browse → Detail → Purchase → Analytics
- Multiple user roles
- Error scenarios

### Manual Tests (Already documented)
- See TESTING_GUIDE.md for detailed checklist

---

## Deployment Architecture

```
Development
├── Frontend: Hot reload with Live Server
├── Backend: npm start (development server)
└── Database: Local instance

Production
├── Frontend: Served via NGINX/CloudFront
├── Backend: Docker container on AWS/GCP
└── Database: Managed RDS/Cloud SQL
    └── Backups: Daily snapshots
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Vanilla JS | ES6+ |
| Styling | CSS3 + Theme Variables | - |
| API Communication | Fetch API | - |
| Backend Framework | NestJS | v10 |
| Language | TypeScript | v5+ |
| Database | TypeORM/MongoDB | - |
| Authentication | JWT Tokens | - |
| Validation | class-validator | - |
| Documentation | Swagger/OpenAPI | v3 |

---

## Scalability Notes

### For 100K Hackathons
- Add pagination: `/hackathons?page=1&limit=20`
- Add database indexes on: name, organizer, date
- Cache popular searches in Redis
- Use CDN for static assets

### For 1M Users
- Implement read replicas for database
- Use message queue for analytics
- Cache promotion plans in memory
- Implement feature flags for A/B testing

### For Payment Processing
- Queue promotion purchases
- Webhook handlers for payment updates
- Stripe/Razorpay integration
- Refund workflow

---

## Future Architecture Changes

1. **Microservices**: Separate services for hackathons, promotions, analytics
2. **Event Streaming**: Kafka/RabbitMQ for real-time analytics
3. **GraphQL**: Replace REST API for complex queries
4. **Machine Learning**: Recommendation engine for matching teams
5. **Real-time**: WebSocket for live hackathon updates

---

**Version**: 1.0  
**Last Updated**: August 31, 2025  
**Maintainer**: TeamForge Dev Team
