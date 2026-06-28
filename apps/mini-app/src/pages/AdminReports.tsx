import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useApi, ReportDto } from "../api";
import { Icon } from "../Icon";
import { useI18n } from "../i18n";

export function AdminReportsPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ALL'>('OPEN');

  const q = useQuery<{ items: ReportDto[]; total: number }>(
    ['admin', 'reports', statusFilter],
    () =>
      api.adminListReports({
        take: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  );

  const resolveMut = useMutation(
    ({ id, status, ban }: { id: string; status: 'REVIEWED' | 'DISMISSED'; ban?: boolean }) =>
      api.adminResolveReport(id, { status, ban }),
    { onSuccess: () => qc.invalidateQueries(['admin', 'reports']) },
  );

  return (
    <div className="adminList">
      <div className="adminList-filters">
        {(['OPEN', 'REVIEWED', 'DISMISSED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${statusFilter === f ? 'chip-active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="adminItems">
          {[0, 1, 2].map((i) => (
            <div key={i} className="adminItem">
              <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 6 }} />
              <div className="adminItem-info">
                <div className="skeleton" style={{ width: "70%", height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "50%", height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {q.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(q.error as Error).message}</span>
        </div>
      )}
      {q.data && (
        <div className="adminList-meta">{q.data.total} report{q.data.total === 1 ? '' : 's'}</div>
      )}

      <div className="adminItems">
        {q.data?.items.map((r) => (
          <article key={r.id} className="adminItem">
            <div className={`adminItem-statusBadge adminItem-statusBadge-${r.status === 'OPEN' ? 'open' : r.status === 'REVIEWED' ? 'finished' : 'cancelled'}`}>
              {r.status}
            </div>
            <div className="adminItem-info">
              <div className="adminItem-title">
                {r.reason} · <strong>{r.target.firstName}</strong>
              </div>
              <div className="adminItem-sub">
                by {r.reporter?.firstName ?? '—'} {r.reporter?.username && `(@${r.reporter.username})`}
                {r.game && ` · game ${r.game.startAt.slice(0, 10)}`}
              </div>
              {r.details && <div className="adminItem-meta">{r.details}</div>}
            </div>
            {r.status === 'OPEN' && (
              <div className="adminItem-actions">
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-warn"
                  onClick={() => {
                    if (window.confirm('Ban this user?')) {
                      resolveMut.mutate({ id: r.id, status: 'REVIEWED', ban: true });
                    }
                  }}
                  disabled={resolveMut.isLoading}
                  title={t('admin.resolveAndBan')}
                >
                  <Icon name="user-remove-01" size={14} />
                </button>
                <button
                  type="button"
                  className="adminItem-btn"
                  onClick={() => resolveMut.mutate({ id: r.id, status: 'REVIEWED' })}
                  disabled={resolveMut.isLoading}
                  title={t('admin.resolve')}
                >
                  <Icon name="checkmark-square-01" size={14} />
                </button>
                <button
                  type="button"
                  className="adminItem-btn adminItem-btn-danger"
                  onClick={() => resolveMut.mutate({ id: r.id, status: 'DISMISSED' })}
                  disabled={resolveMut.isLoading}
                  title={t('admin.dismiss')}
                >
                  <Icon name="cancel-01" size={14} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
