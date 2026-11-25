# TeamForge Policy and Work Plan (Revised)

Nov 10, 2026 · @aditya

## Summary

TeamForge gets one moderation system: warnings, appeals, reputation and suspension work together, and every moderator action carries a written explanation. Your answers settled the seven open questions as follows.

| # | Question | Decision | What it means |
|---|---|---|---|
| 1 | Warning appeals | Yes, and they change reputation | An accepted appeal removes the warning and gives back its 10 reputation |
| 2 | Seeded demo users | Keep current reputation | Only new accounts start at 100 |
| 3 | Reactivation message | Notification only | No mail is sent on reactivation |
| 4 | Support requests | Stay separate from reports | The Reports section holds user reports and appeals only |
| 5 | Request limit | 2 requests per project in total | Counts every request sent, not only rejected ones |
| 6 | Suspension effects | Release tasks, close the owner's project, pay the mentor | See the suspension section |
| 7 | Projects with no applicants | Close after 5 days | The owner can create a new project |

### Changes from the earlier plan:
- The warning threshold is 4, not 3, so the flowchart is redrawn.
- A suspended owner's project is closed, which is a new status separate from Completed.
- Appeals are added to the flowchart and to the admin Reports section.
- One scheduled job runs hourly for missed deadlines, mentor response timeouts and no-applicant closing.
- Platform Config can only raise the mentor minimum above 5 years; the maximum is fixed at 40.

---

## Warnings, appeals and reputation

A user is suspended automatically on their fourth active warning. Each warning costs 10 reputation, and a successful appeal wins the warning and its 10 reputation back.

### Warning, suspension and reactivation
1. Warn, suspend and reactivate each require a written explanation of at least 10 characters. The user sees it.
2. A warning sends a notification titled with the count (Warning 1/4, 2/4, 3/4, 4/4) and a mail with the explanation.
3. The fourth active warning suspends the account automatically. The reason is "Automatic suspension after 4 warnings", and a mail is sent.
4. A manual suspension sends a mail only, because the user can no longer log in.
5. Reactivation sends a notification only. It clears the active warning count and keeps the history, so the next warning starts again at 1/4.
6. Every action is written to the audit log with the moderator, the user, the explanation and the new warning count.

| Action | Mail | Notification | Reputation |
|---|---|---|---|
| Warning | Yes | Yes, with N/4 | -10 |
| Suspension (manual or automatic) | Yes | No | No change |
| Reactivation | No | Yes | No change |
| Warning removed by appeal or review | No | Yes | +10 |

### Appeals
- A user may appeal each warning once, within 7 days, with an explanation of at least 20 characters.
- Appeals appear in the admin Reports section under their own tab.
- Accepted: the warning is removed, 10 reputation is restored, the active count drops, and the user is notified.
- Rejected: the warning stays active, the admin's reason is sent to the user, and no second appeal is allowed.
- Accepting an appeal never reactivates a suspended account by itself; an admin does that.
- A suspended user cannot appeal inside the app. An admin can still withdraw earlier warnings while reviewing a report.

### Reputation
New accounts start at 100. Seeded demo users keep their current values. Reputation never goes below 0 and does not affect XP.

| Event | Change | Notes |
|---|---|---|
| Account created | Start at 100 | New accounts only |
| Task approved | +8 | To the assignee |
| Warning issued | -10 | Per warning |
| Warning removed | +10 | Gives back the same amount |
| Missed task deadline | -5 | Once per task, to the assignee |
| Badge awarded | 0 | Recognition only |

Reputation is stored as typed entries in the same ledger as XP, so every screen reads the same value.

---

## Suspension and closed projects

Suspension blocks login and every API call immediately, and the platform then protects the people who depend on the suspended user.

| Who is suspended | What happens | Who is told |
|---|---|---|
| Collaborator | Tasks that are Open or In Progress return to Unassigned and Open. Tasks already In Review stay for the owner to decide. Approved work and earned XP stay. Membership stays until the owner removes the person. | The owner, with the list of released tasks |
| Project owner | Every project they own is closed with the reason "Owner suspended". Closed projects are read-only. An active mentor session is paid out to the mentor. A session the mentor has not accepted yet is refunded in full. Pending join requests are closed without counting against the applicants. | All collaborators and the mentor of each project |
| Mentor (proposed) | Sessions not yet accepted are refunded. Active sessions are refunded in full and the project's mentor slot is freed, so the owner can book another mentor. | The owners and collaborators of those projects |

### Closed status
Closed is a project status separate from Completed. A closed project:
- is read-only, with the same lock as a completed project;
- never appears in the marketplace or in the Completed lists;
- shows its reason ("Owner suspended" or "No applicants within 5 days") in owner My Projects and in the admin Projects table;
- cannot be reopened. Reactivating a suspended owner does not reopen their projects, and the owner creates a new project if needed.

### Payout when an owner is suspended
The mentor is paid the full session price from escrow, the same payout as on completion. The platform fee stays as platform revenue, and the gateway fee is recorded as before. The audit log records the closure and each payout with the reason.

---

## Joining a project

A collaborator gets at most two requests per project, every owner rejection comes with a written reason, and a project nobody joins within 5 days is closed.

### Requests and rejections
1. The limit is 2 requests per person per project, counted when a request is sent. Pending, rejected, withdrawn and approved requests all count.
2. Requests closed by the system do not count: project full, project closed, or owner suspended.
3. A rejection needs a reason of at least 10 characters. The collaborator sees it in a notification and on the Applied Projects row.
4. After the first rejection, Apply stays available with the hint "1 request left".
5. After the second request is rejected, Apply is replaced by a disabled "Request rejected" tag on the project card, the preview and Applied Projects. The back end refuses further requests with 409 "Request limit reached for this project".
6. While a request is pending the card shows "Request pending".
7. The limit is per project. A rejection on one project never affects another.
8. A member removed by the owner stays banned from that project, with the removal reason shown, as today.

### When nobody joins
- The owner gets a reminder on day 4 after creation if the project has no approved collaborator.
- On day 5 a project with no approved collaborator and no pending request is closed with the reason "No applicants within 5 days".
- Pending requests pause the closing, and the owner is reminded to decide them.
- Any mentor session on the project is refunded in full and the mentor is notified.
- The owner can create a new project. A closed project is never reopened.

---

## Leaving a project

A collaborator must state why they are leaving, and sees the leaving policy before they confirm.
- The leave dialog asks for a reason category (Too busy, Project not as described, Conflict with the team, Personal reasons, Other) and a written explanation of at least 10 characters.
- The owner is notified with the category and explanation, and the audit log records them.
- Before confirming, the dialog lists the policy: unapproved tasks return to Unassigned; approved work and earned XP stay; deadline penalties already applied stay; leaving is not possible after the project is completed or closed; a mentor cannot leave.
- Leaving frees the collaborator slot at once.
- Re-applying is allowed, but it uses one of the two requests allowed for that project.

---

## Mentor rules

Mentor applications need 5 to 40 years of experience, and a mentor who rejects a booking must tell the owner why.

| Rule | Detail |
|---|---|
| Years of experience | Whole number from 5 to 40, checked in the form and on the server |
| Platform Config minimum | Can only raise the minimum above 5. The default becomes 5. The maximum of 40 is fixed |
| Rejecting a booking | Reason of at least 10 characters, shown to the owner in a notification and on the session row |
| Refund on rejection | Full refund to the owner, as today, and the project is free for another mentor |
| Response deadline | 3 days. With no answer the request is declined automatically, the owner is refunded in full, and both sides are notified |
| After acceptance | The mentor cannot leave or be removed until the project is completed or closed |

The response deadline stops escrow and the one-mentor-per-project hold from staying stuck when a mentor never replies.

---

## Reporting users and the Reports section

Any user can report another user from Help & Support, and admins review every report in a new Reports section. Ordinary support requests stay separate from reports.

### Reporting a user
1. The reporter types in a search box and picks one user from the dropdown. It shows name, username and university only, never an email.
2. They choose a reason: Harassment, Spam, Cheating or plagiarism, Fake proof, Abandoned work, Inappropriate content, or Other.
3. They add an explanation of at least 20 characters in a text box.
4. Limits: no reports against yourself or against admin accounts, 5 reports per day, and no second open report against the same user from the same reporter.
5. The reported user is never told who reported them.

### Reports section for Admin and Super User
- It is a new sidebar section with its own permission key, so Manage Admins gets a Reports checkbox. The back end enforces the key on every route.
- Two tabs: User reports and Appeals.
- Each report shows the reporter, the reported user, the reason, the explanation, and that user's earlier warnings and reports.
- A View audit log link opens the audit log filtered to the reported user.
- Statuses: Open, Under review, Resolved (action taken), Dismissed. Every change takes an admin note.
- Actions: Warn, Suspend or Dismiss, each with an explanation, and each goes through the rules in the warnings section.
- The reporter is told the outcome in one line, without details about the action.
- Every report, status change and action is written to the audit log.
- Ordinary support requests still have no admin inbox. That gap is left open for now.

---

## Deadlines

Every task needs a due date, a missed due date costs the assignee 5 reputation once, and the owner can move the project deadline with a reason.

### Task deadlines and the penalty
- A task due date becomes required. It cannot be after the project due date.
- The penalty applies when a due date passes while the task is still Open or In Progress. It is checked once an hour and applied from midnight (server time) after the due date.
- It is applied once per task, to the assignee at that moment. Unassigned tasks carry no penalty.
- A late submission keeps the penalty. A later extension does not remove it.
- The owner may move a task due date until that date has passed. An extension made in time prevents the penalty.
- The assignee is notified when the penalty is applied.

### Owner changes the project deadline
1. The owner can change the project due date until the project is completed or closed.
2. A reason of at least 10 characters is required.
3. The new date must be in the future and not earlier than the latest task due date.
4. Collaborators and the mentor are notified with the old date, the new date and the reason.
5. The change is written to the audit log. Penalties already applied are not reversed.

---

## Username bug and smaller fixes

Google and GitHub sign-in have no username step, so the username is taken from the email before the @. The fix is a required profile step after social sign-in, and a check that normal signup keeps what the user typed.

### Username on social sign-in
1. Test both paths first: a normal signup with a username that differs from the email, and a Google or GitHub sign-in. Compare what the profile call sends and what the server stores.
2. After a social sign-in with no profile yet, show a Complete your profile page before anything else. It asks for a username (required, unique, same rules as signup), with the name pre-filled from the provider and editable, and a university field (optional).
3. The page blocks the app until it is saved. The server refuses to create a profile without a username.
4. Remove every place that builds a username from an email, including the seed and migration code.
5. Existing accounts whose username equals their email prefix are flagged. At next login they are asked to confirm or choose a username.
6. On the signup page, the Google and GitHub buttons send the user to the same completion page. They do not reuse the typed username without checking that it is free.

### Smaller changes
| Item | Change |
|---|---|
| Admin Projects table | Remove the Difficulty column. Project Details keeps it unless you say otherwise |
| Help & Support | Add the Report a user form. Existing support requests stay as they are |
| Settings | University field already planned stays; nothing else changes |

---

## Work plan

The work splits into six phases. Phase 1 comes first because reports, penalties and closing all use its warning, reputation and Closed-status code.

| Phase | Work | Needs | Done when |
|---|---|---|---|
| 1. Moderation core | Warning records with explanations, N/4 notices, automatic suspension on the fourth warning, mail service, reputation ledger (start 100, +8, -5, -10), suspension rules for collaborators, owners and mentors, Closed status | None | A warning costs 10 reputation, the fourth suspends, mail and notifications arrive, and an owner's suspension closes the project and pays the mentor |
| 2. Appeals and Reports | Report a user form in Help & Support with user search, Reports section with Reports and Appeals tabs and its permission key, audit log filter link, appeal flow | Phase 1 | A report can be filed, reviewed and acted on, and an accepted appeal restores 10 reputation |
| 3. Joining and leaving | Two-request limit, rejection reason, Request rejected tag, leave reason and policy dialog, no-applicant closing with the day-4 reminder | Phase 1 | A third request is refused in the UI and by the API, and a project with no joiners closes on day 5 |
| 4. Mentors and deadlines | Years 5 to 40 and Platform Config floor, mentor rejection reason, 3-day auto-decline, required task due dates, missed-deadline penalty, owner deadline change | Phase 1 | A missed deadline costs 5 once, and an unanswered booking is refunded after 3 days |
| 5. Username and UI | Social sign-in profile step, repair of email-derived usernames, Difficulty column removal | None | A Google or GitHub account cannot finish sign-in without choosing a unique username |
| 6. Docs and checks | README, SRS, RBAC matrix, work division notes, full regression with several accounts | Phases 1 to 5 | Every item in the checklist below passes |

One scheduled job runs every hour and covers missed deadlines, mentor response timeouts, no-applicant closing and the day-4 reminder. It must be safe to run twice, so no penalty or refund is applied twice.
Every rule is enforced on the back end, not only in the UI. The Reports routes check the new permission key, and the audit log records every action in this document.

---

## Test checklist

- [ ] Four warnings in a row show 1/4, 2/4, 3/4, 4/4 and the fourth suspends the account.
- [ ] Each warning lowers reputation by 10 and an accepted appeal gives it back.
- [ ] Warn, suspend and reactivate cannot be saved without an explanation.
- [ ] Warnings and suspensions send mail; reactivation sends only a notification.
- [ ] A suspended collaborator's tasks return to Unassigned and the owner is told.
- [ ] A suspended owner's project closes, collaborators are told, and the mentor is paid.
- [ ] A third request to the same project is refused, and the second rejection shows Request rejected.
- [ ] An owner cannot reject a request without a reason, and the collaborator sees it.
- [ ] A collaborator cannot leave without a reason, and the owner sees it.
- [ ] Mentor years outside 5 to 40 are refused by the form and by the API.
- [ ] A mentor cannot reject a booking without a reason, and the owner sees it.
- [ ] An unanswered booking is refunded after 3 days.
- [ ] A project with no joiners closes after 5 days.
- [ ] A missed task deadline costs 5 reputation once.
- [ ] A user report reaches the Reports section, and the audit log link opens filtered to that user.
- [ ] A Google or GitHub sign-in cannot finish without a unique username.
