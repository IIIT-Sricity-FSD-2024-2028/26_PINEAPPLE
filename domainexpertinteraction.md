# Summary of the interaction

## Basic information
* **Domain:** Digital Project Collaboration Systems
* **Problem statement:** Students/freshers often struggle to find meaningful project collaboration opportunities to apply skills and gain hands-on experience. Existing platforms lack structured collaboration, guided learning, and transparent contribution tracking.
* **Date of interaction:** 2026-01-31
* **Mode of interaction:** Video call 
* **Duration (in-minutes):** *46 minutes*
* **Publicly accessible Video link:** *[DomainExpertInteractionVideo](https://www.canva.com/design/DAHAGdJNfQQ/veVtcwMirNSLuwSn5XmHLw/edit?utm_content=DAHAGdJNfQQ&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)*

## Domain Expert Details
* **Role/ designation:** *Senior Software Specialist*
* **Experience in the domain:** *12 yrs*
* **Nature of work:** Developer

## Domain Context and Terminology
* **How would you describe the overall purpose of this problem statement in your daily work?**
    Currently, collaboration is managed through disjointed tools: code hosting platforms are used for storage and professional networking sites for connections. However, these existing workflows lack structure and do not provide integrated guidance or transparent tracking of contributions.
* **What are the primary goals or outcomes of this problem statement?**
    1.  Bridge the gap between academic learning and practical experience.
    2.  Provide a dedicated platform for structured collaborations and mentorship.
    3.  Create verifiable contribution records (Audit Logs/Contribution History) for transparency.

* **List key terms used by the domain expert and their meanings**

| Term | Meaning as explained by the expert |
| :--- | :--- |
| **Project Owner** | A user who initiates a project, defines scope, assigns tasks, and manages execution. |
| **Collaborator** | A user who contributes work to assigned tasks to gain practical experience and earn XP. |
| **Mentor** | An experienced individual who provides guidance and suggestions without evaluating or rating work. |
| **Audit Log** | A system-generated, immutable record of significant actions maintained for transparency and dispute resolution. |
| **Contribution History** | A verifiable record of a user’s completed tasks and roles, derived from audit logs. |
| **XP & Leaderboard** | A gamified system where collaborators accrue Experience Points (XP) and compete for rankings based on approved work. |
| **Chat Box** | A communication tool used for team coordination and mentorship guidance. |

## Actors and Responsibilities
* **Identify the different roles involved and what they do in practice.**

| Actor / Role | Responsibilities |
| :--- | :--- |
| **Project Owner** | **Lifecycle & Recruitment:** Initiate projects with clear scopes and strategically recruit collaborators based on skills. <br> **QA & Evaluation:** Validate deliverables (approve/rework), assign ratings/reviews, and monitor progress via dashboards. |
| **Collaborator** | **Execution & Growth:** Discover projects via skills, execute tasks, and engage in feedback loops. <br> **Gamification & Proof:** Earn XP/Levels, compete on the Leaderboard, and showcase a Project Portfolio. <br> **Communication:** Use the Chat Box for coordination. |
| **Mentor** | **Advisory:** Provide technical consultation and share resources via the Chat Box. <br> **Workflow:** Manage requests (Accept/Decline) from Project Owners. <br> **Scouting:** Identify and formally recommend skilled students to owners. |
| **Administrator** | **Governance:** Monitor system health, enforce policies, and manage account restrictions. <br> **Resolution:** Resolve disputes using immutable Audit Logs. |

## Core workflows

* **Workflow 1: Project Setup & Strategic Recruitment**
    * **Trigger/start condition:** Project Owner decides to start a new initiative.
    * **Steps involved:**
        1.  **Lifecycle Initiation:** Create project structures and define comprehensive scopes/roadmaps.
        2.  **Strategic Recruitment:** Review applicant profiles based on required skills.
        3.  **Selection:** Invite specific collaborators to build a balanced team.
    * **Outcome / End condition:** Project is live with a recruited team.

* **Workflow 2: Task Execution & XP Cycle**
    * **Trigger/start condition:** Collaborator accepts an assignment.
    * **Steps involved:**
        1.  **Execution:** Collaborator performs the task and uses the **Chat Box** for coordination.
        2.  **Submission:** Tasks are submitted for QA Review.
        3.  **QA Review:** Project Owner validates work against requirements.
        4.  **Decision:** Owner approves work (triggering **XP/Level** gain) or triggers a rework loop.
    * **Outcome / End condition:** Task is completed, and Contribution History/Portfolio is updated.

* **Workflow 3: Mentorship Lifecycle**
    * **Trigger/start condition:** Project Owner sends a request to a Mentor.
    * **Steps involved:**
        1.  **Manage Requests:** Mentor reviews the projects requesting guidance.
        2.  **Decision:** Mentor decides to **Accept** or **Decline** the request.
        3.  **Consultation:** If accepted, Mentor provides technical suggestions and shares resources via the **Chat Box**.
        4.  **Recommendation:** Mentor may identify high-potential talent and recommend them for future roles.
    * **Outcome / End condition:** Guidance is provided without evaluation/grading.

## Rules, Constraints, and Exceptions
* **Mandatory rules or policies:**
    * Mentors strictly **do not** evaluate, approve, or rate projects; their role is purely advisory.
    * Platform Policies govern acceptable behavior and ethics.
* **Constraints or limitations:**
    * **Non-Evaluative Mentorship:** Mentors are distinct from administrative management.
    * **Immutable Logs:** Audit Logs are used for transparency and cannot be altered.
* **Common exceptions or edge cases:**
    * Disputes regarding task outcomes or feedback require administrative intervention via Dispute Resolution.

## Current challenges and pain points
* **What parts of this process are most difficult or inefficient?**
    * **Lack of Structure:** Collaboration in current tools often lacks structured workflows, leading to coordination inefficiencies.
* **Where do delays, errors, or misunderstandings usually occur?**
    * **Guidance Gap:** Standard tools focus on hosting code but lack the guided learning or mentorship loops necessary for efficient development.
* **What information is hardest to track or manage today?**
    * **Opacity:** Transparent contribution tracking is missing, making it difficult to verify who actually performed specific work in a group setting.

## Assumptions & Clarifications
* **What assumptions made by the team that were confirmed**
    * Confirmed that Mentors are non-evaluative; they do not approve work, only guide.
    * Confirmed that the platform includes both **XP/Levels** (for gamification) and **Ratings** (for performance evaluation), serving distinct purposes.
* **What assumptions that were corrected**

    * **Initial assumption:** The team believed mentors would have "Super Admin" rights to resolve disputes between Project Owners and Collaborators.

    * **Correction:** The domain expert clarified mentors must remain neutral advisors; dispute resolution is strictly an Administrator responsibility to prevent bias.

    * **Initial assumption:** Any user could immediately become a Mentor by achieving high XP.

    * **Correction:** High XP alone is insufficient; mentors require a vetted status or manual approval to ensure they provide quality advice, distinguishing them from high-performing collaborators.
* **Open questions that need follow-up**
    * Abandonment Penalties: What happens if a Collaborator accepts a task but goes silent (ghosts)? Do they lose XP, or are they just restricted from applying          for new tasks for a set period?
