const fs = require('fs');
const file = 'back-end/src/mentor-marketplace/mentor-marketplace.service.ts';
let content = fs.readFileSync(file, 'utf8');

const methods = `
  handleProjectClosed(projectId: string, reason: string): void {
    const liveSessions = this.sessions.filter(
      (s) => String(s.projectId) === String(projectId) && (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payment_pending'),
    );

    for (const session of liveSessions) {
      if (session.status === 'active') {
        try {
          this.completeSession(session.id, undefined, true);
          this.auditService.log({
            action: 'owner-suspension-payout',
            actor: 'System',
            target: \`Session #\${session.id}\`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: \`Project closed (\${reason}): Active mentor session paid out to mentor from escrow\`,
            details: { projectId, reason, sessionPrice: session.agreedPrice, payout: session.payout },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error completing session on project close:', err?.message || err);
        }
      } else if (session.status === 'escrow_funded') {
        try {
          this.escrowService.refund(session.escrowId);
          session.status = 'refunded';
          const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
          this.notificationsService.create({
            userId: session.studentId,
            type: 'MENTOR_SESSION_REFUNDED',
            title: 'Mentor Booking Refunded',
            message: \`Project was closed (\${reason}). ₹\${session.totalAmount || totalAmount} refunded.\`,
            readStatus: false,
            referenceId: session.id,
          });
          this.auditService.log({
            action: 'project-closed-mentor-refund',
            actor: 'System',
            target: \`Session #\${session.id}\`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: \`Project closed (\${reason}): Pending mentor booking refunded in full (₹\${session.totalAmount || totalAmount})\`,
            details: { projectId, reason },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error refunding pending session on project close:', err?.message || err);
        }
      } else if (session.status === 'payment_pending') {
        session.status = 'cancelled';
      }
    }
  }

  handleMentorSuspension(mentorUserId: string): void {
    const profile = this.profiles.find(
      (p) => String(p.userId) === String(mentorUserId) || String(p.id) === String(mentorUserId),
    );
    const mentorId = profile?.id || mentorUserId;

    const liveSessions = this.sessions.filter(
      (s) => (String(s.mentorId) === String(mentorId) || String(s.mentorId) === String(mentorUserId)) &&
        (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payment_pending'),
    );

    for (const session of liveSessions) {
      if (session.status === 'payment_pending') {
        session.status = 'cancelled';
      } else if (session.status === 'escrow_funded' || session.status === 'active') {
        const wasActive = session.status === 'active';
        try {
          this.escrowService.refund(session.escrowId);
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed escrow refund error on mentor suspension:', err?.message || err);
        }
        session.status = 'refunded';

        const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

        if (wasActive && session.projectId) {
          try {
            const project = this.projectsRepository.findById(session.projectId);
            if (project) {
              project.mentorId = null as any;
              project.mentor = null as any;
              this.projectsRepository.update(project.id, {
                mentorId: null,
                mentor: null,
              } as any);

              this.notificationsService.create({
                userId: project.ownerId,
                type: 'MENTOR_SUSPENDED',
                title: 'Mentor Slot Freed',
                message: \`The project mentor was suspended. Your active session has been refunded in full and the mentor slot is freed for booking another mentor.\`,
                readStatus: false,
                referenceId: project.id,
              });
            }
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Error freeing project mentor slot:', err?.message || err);
          }
        } else {
          try {
            this.notificationsService.create({
              userId: session.studentId,
              type: 'MENTOR_SESSION_REFUNDED',
              title: 'Mentor Booking Refunded',
              message: \`Your mentor was suspended. ₹\${session.totalAmount || totalAmount} has been refunded in full.\`,
              readStatus: false,
              referenceId: session.id,
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed notification error on mentor suspension:', err?.message || err);
          }
        }

        try {
          this.auditService.log({
            action: 'mentor-suspension-session-refunded',
            actor: 'System',
            target: \`Session #\${session.id}\`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: \`Mentor suspended: \${wasActive ? 'active' : 'pending'} session refunded in full (₹\${session.totalAmount || totalAmount}) and slot freed\`,
            details: { projectId: session.projectId, wasActive },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error logging audit on mentor suspension:', err?.message || err);
        }
      }
    }
  }
`;

const target = '  private findSession(id: string): MentorSessionEntity {';
if (!content.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
content = content.replace(target, methods + '\n' + target);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated mentor-marketplace.service.ts');
