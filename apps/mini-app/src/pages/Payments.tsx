import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useApi, CURRENCY_SYMBOLS } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';

function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] ?? currency;
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

export function PaymentsPage() {
  const api = useApi();
  const { t } = useI18n();

  const myQ = useQuery(['payments', 'mine'], () => api.listMyPayments());

  const unpaid = (myQ.data ?? []).filter((p) => !p.isPaid);

  return (
    <div className="paymentsPage">
      <header className="page-header">
        <div className="page-header-icon">
          <Icon name="wallet-01" size={20} />
        </div>
        <div>
          <h1 className="page-header-title">{t('payments.title')}</h1>
        </div>
      </header>

      {unpaid.length > 0 && (
        <div className="card paymentsUnpaid">
          <h2 className="formSection-title">
            <span className="formSection-num">
              <Icon name="bell-dot" size={12} />
            </span>
            {t('payments.unpaid')}
          </h2>
          {unpaid.map((p) => (
            <Link
              key={p.id}
              to={`/games/${p.game.id}`}
              className="paymentsUnpaid-row"
              data-analytics-label={`payments-unpaid-${p.id}`}
            >
              <span className="paymentsUnpaid-amount">
                {formatMoney(p.amount, p.currency)}
              </span>
              <span className="paymentsUnpaid-info">
                <span className="paymentsUnpaid-venue">{p.game.venue.name}</span>
                <span className="paymentsUnpaid-when">
                  {new Date(p.game.startAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {myQ.isLoading && <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />}

      {!myQ.isLoading && (myQ.data ?? []).length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="credit-card" size={24} />
          </div>
          <div className="empty-state-title">No payments yet</div>
        </div>
      )}

      <div className="paymentsList">
        {(myQ.data ?? []).map((p) => (
          <article key={p.id} className="paymentItem">
            <span className={`paymentItem-pill ${p.isPaid ? 'isPaid' : 'isUnpaid'}`}>
              {p.isPaid ? t('payments.paid') : t('payments.unpaid')}
            </span>
            <div className="paymentItem-info">
              <div className="paymentItem-venue">{p.game.venue.name}</div>
              <div className="paymentItem-meta">
                {formatMoney(p.amount, p.currency)} ·{' '}
                {new Date(p.game.startAt).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <Link to={`/games/${p.game.id}`} className="btn btn-ghost">
              <Icon name="arrow-right-01" size={14} />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}