# Policy Decisions & Questions for TeamForge

This document outlines key policy decisions and edge cases that require architectural alignment. Each item includes the context, viable alternatives, and a **recommended default** aligned with TeamForge's existing moderation and operational standards.

---

## 1. Project Health Analytics: View Tracking & Deduplication Policy

### Context
The proposed Project Health Panel (`PRJ-02`) tracks impressions and detail previews so owners understand candidate drop-off. Without deduplication, an owner or single visitor refreshing the page could artificially inflate view counts.

### Options
- **Option A (Strict Unique User)**: Only count authenticated users; limit to 1 preview per user per project lifetime.
- **Option B (Recommended - Rolling 1-Hour Cooldown)**: Count both authenticated users (by user ID) and guests (by IP hash); deduplicate views within a 1-hour sliding window.
- **Option C (Raw Counter)**: Increment every page hit with zero deduplication.

### Recommendation
**Adopt Option B**. Rolling 1-hour cooldown provides realistic traffic telemetry while preventing spam from page reloads. Guest previews should be captured because many students browse projects before logging in.

---

## 2. Zombie Project Auto-Close: Pending Application Grace Window

### Context
Under current policy (`jobs.service.ts:91-112`), if a 5-day-old project has pending join requests, auto-close pauses and sends a notification to the owner. If the owner has abandoned the platform, the project remains paused forever, trapping applicant request slots.

### Options
- **Option A (Recommended - 48-Hour Hard Grace Period)**: Pause auto-close on Day 5 and send reminder. If owner takes no action within 48 hours (Day 7 total), auto-close all pending requests as `system_closed` and close the project.
- **Option B (Immediate Close on Day 5)**: Ignore pending requests; close project immediately on Day 5 and convert pending requests to `system_closed`.
- **Option C (Infinite Pause)**: Maintain current behavior (pause forever until owner logs in).

### Recommendation
**Adopt Option A**. 48 hours gives active owners adequate time to evaluate candidates while ensuring projects do not turn into permanent zombie listings. The `system_closed` status guarantees applicants do not forfeit one of their two lifetime applications.

---

## 3. Inactive / Ghost Mentor Resolution Threshold

### Context
Current rules prohibit mentors from leaving or being removed once assigned (`projects.service.ts:761`). If a mentor abandons the project, escrow funds remain locked and the team cannot request a replacement.

### Options
- **Option A (Recommended - 7-Day Inactivity + 48-Hour Check-In Grace)**: If a mentor records 0 chat messages and 0 session updates for 7 consecutive days, the owner can initiate an "Abandonment Review". Mentor has 48 hours to confirm activity; failure to respond auto-unassigns mentor and 100% refunds escrow.
- **Option B (Admin Dispute Only)**: Owner must submit an admin support ticket; admin investigates manually and releases funds.
- **Option C (Mutual Release Only)**: Escrow can only be unlocked if the mentor signs into the app and clicks "Approve Mutual Release".

### Recommendation
**Adopt Option A**. Automated inactivity detection prevents platform gridlock without placing an administrative burden on support staff. If the mentor has genuinely vanished, the student team is unblocked within 9 days.

---

## 4. Task Revision / Rejection Reason Standard

### Context
Moving a task from `InReview` back to `ToDo` or `InProgress` currently sends a generic notification with no explanation (`tasks.service.ts:926-945`).

### Options
- **Option A (Recommended - Mandatory Reason, 10 to 500 characters)**: Require a written explanation matching the standard used for join request rejections and user warnings.
- **Option B (Optional Reason)**: Allow the owner to leave the feedback field blank.
- **Option C (Category Selection + Optional Note)**: Provide a dropdown (e.g., "Incomplete code", "Failing tests", "Needs documentation") with optional notes.

### Recommendation
**Adopt Option A**. Mandatory feedback between 10 and 500 characters ensures collaborators receive actionable critique, eliminating ambiguity and fostering genuine pair-programming learning.

---

## 5. Warning Expiry & Good Standing Decay

### Context
Under Phase 1, warnings accumulate toward automatic suspension at 4 active warnings (`moderation.service.ts`). Once issued, warnings remain active indefinitely unless successfully appealed within 7 days.

### Options
- **Option A (Recommended - 90-Day Good Standing Decay)**: An active warning automatically transitions to "archived" status if the user maintains 90 consecutive days without receiving a new warning. Archived warnings do not count toward the 4-warning suspension threshold, but reputation deduction (-10) remains.
- **Option B (Permanent Warnings)**: Active warnings never decay; a warning received on Day 1 remains active on Day 500.
- **Option C (Annual Reset)**: All active warnings reset to zero on January 1.

### Recommendation
**Adopt Option A**. Permanent warnings discourage long-term platform engagement, while annual resets are arbitrary. A 90-day rolling rehabilitation window rewards consistent good behavior while maintaining disciplinary accountability.

---

## 6. Join Request Withdrawal Quota Restitution

### Context
Collaborators are limited to 2 join requests per project (`join-requests.service.ts:355`). If a user applies and immediately realizes they clicked the wrong project, withdrawing the application currently consumes 1 of their 2 lifetime slots.

### Options
- **Option A (Recommended - 2-Hour Grace Restitution)**: If an applicant withdraws a request within 2 hours of submitting it, AND the owner has not yet viewed or responded to it, the application does not count toward the 2-request limit.
- **Option B (Never Restitute)**: Any submitted request permanently counts against the quota, even if withdrawn 10 seconds later.
- **Option C (Always Restitute Withdrawn Requests)**: Any withdrawal at any time restores the quota slot.

### Recommendation
**Adopt Option A**. Prevents accidental misclicks from penalizing candidates, while preventing candidates from gaming the system by repeatedly applying, withdrawing, and re-applying to stay at the top of the owner's review queue.

---

## 7. Task Submission Proof Protocol & Domain Whitelist

### Context
Task proof links (`tasks.service.ts:972`) require protocol validation to prevent stored XSS via `javascript:` links.

### Options
- **Option A (Recommended - Strict HTTP/HTTPS with Generic Interstitial Warning)**: Accept any URL beginning with `http://` or `https://`. When clicked, open an interstitial modal: *"You are navigating to an external domain: [domain]. Ensure you trust this source."*
- **Option B (Domain Whitelist)**: Only allow proof links from pre-approved domains (e.g., `github.com`, `gitlab.com`, `figma.com`, `loom.com`, `google.com`).
- **Option C (Direct Open without Warning)**: Accept `http://` or `https://` and open immediately in a new tab.

### Recommendation
**Adopt Option A**. Academic student projects use diverse deployment targets (Vercel, Netlify, Render, personal portfolio domains, AWS S3). A domain whitelist is overly restrictive, while an interstitial warning provides strong security against phishing and malicious links.

---

## 8. Preserving In-Review Tasks on Collaborator Departure

### Context
When a collaborator leaves a project, `resetUnapprovedTasksForUser` (`tasks.service.ts:311`) resets `InReview` tasks to `ToDo` and deletes submitted proof. In contrast, collaborator suspension preserves `InReview` tasks (`tasks.service.ts:345`).

### Options
- **Option A (Recommended - Align with Suspension Policy)**: Preserve `InReview` tasks upon collaborator departure. The task remains in `InReview`, allowing the owner to evaluate the work already submitted. If approved, the departed collaborator receives the XP earned.
- **Option B (Always Reset & Delete Proof)**: Delete all unapproved tasks regardless of whether they were in review.
- **Option C (Archive Task as Abandoned)**: Mark in-review task as `abandoned` and award 50% partial XP.

### Recommendation
**Adopt Option A**. Deleting completed work that was already submitted for review punishes students who legitimately finished their assignment before leaving a project due to scheduling conflicts.
