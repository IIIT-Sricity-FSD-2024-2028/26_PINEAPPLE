import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';

const EscrowFinancialsCard = ({ escrowSummary }) => {
  return (
    <div className="card admin-escrow-card" data-testid="admin-project-escrow-panel">
      <div className="admin-escrow-header">
        <h2 className="admin-card-title">Project Escrow Ledger</h2>
        {escrowSummary && (
          <Badge variant={escrowSummary.ok ? 'success' : 'danger'}>
            {escrowSummary.ok ? 'Reconciled' : 'Mismatch Detected'}
          </Badge>
        )}
      </div>

      {escrowSummary ? (
        <>
          <div className="admin-escrow-metrics-grid">
            <div className="admin-escrow-metric-item">
              <div className="admin-escrow-metric-label">Owner Paid</div>
              <div className="admin-escrow-metric-value">
                ₹{(escrowSummary.totals?.ownerPaid || 0).toLocaleString()}
              </div>
            </div>
            <div className="admin-escrow-metric-item admin-escrow-metric-item--held">
              <div className="admin-escrow-metric-label">Currently Held</div>
              <div className="admin-escrow-metric-value">
                ₹{(escrowSummary.totals?.inEscrow || 0).toLocaleString()}
              </div>
            </div>
            <div className="admin-escrow-metric-item admin-escrow-metric-item--released">
              <div className="admin-escrow-metric-label">Released to Mentor</div>
              <div className="admin-escrow-metric-value">
                ₹{(escrowSummary.totals?.mentorPayout || 0).toLocaleString()}
              </div>
            </div>
            <div className="admin-escrow-metric-item admin-escrow-metric-item--refunded">
              <div className="admin-escrow-metric-label">Refunded to Owner</div>
              <div className="admin-escrow-metric-value">
                ₹{(escrowSummary.totals?.refunds || 0).toLocaleString()}
              </div>
            </div>
            <div className="admin-escrow-metric-item admin-escrow-metric-item--fee">
              <div className="admin-escrow-metric-label">Platform Fee</div>
              <div className="admin-escrow-metric-value">
                ₹{(escrowSummary.totals?.platformFee || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="admin-escrow-table-wrapper mt-4">
            <DataTable
              columns={[
                {
                  header: 'Session',
                  key: 'sessionId',
                  render: (s) => `#${String(s.sessionId).slice(-8)}`,
                },
                { header: 'Mentor', key: 'mentorName' },
                {
                  header: 'Status',
                  key: 'status',
                  render: (s) => (
                    <Badge
                      variant={
                        s.status === 'disputed'
                          ? 'danger'
                          : s.status === 'completed'
                          ? 'success'
                          : 'info'
                      }
                    >
                      {s.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Held',
                  key: 'held',
                  render: (s) => `₹${(s.held || 0).toLocaleString()}`,
                },
                {
                  header: 'Released',
                  key: 'released',
                  render: (s) => `₹${(s.released || 0).toLocaleString()}`,
                },
                {
                  header: 'Refunded',
                  key: 'refunded',
                  render: (s) => `₹${(s.refunded || 0).toLocaleString()}`,
                },
                {
                  header: 'Fee',
                  key: 'platformFee',
                  render: (s) => `₹${(s.platformFee || 0).toLocaleString()}`,
                },
                {
                  header: 'Dispute',
                  key: 'dispute',
                  render: (s) =>
                    s.dispute
                      ? `${s.dispute.status} (${s.dispute.decision || 'under review'})`
                      : 'None',
                },
              ]}
              data={escrowSummary.sessions || []}
              emptyTitle="No escrow sessions"
              emptyMessage="This project has no mentor escrow transactions yet."
            />
          </div>
        </>
      ) : (
        <p className="text-muted mt-3">Escrow details are currently unavailable.</p>
      )}
    </div>
  );
};

export default EscrowFinancialsCard;
