import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi, AdminFbOffer } from '../api';
import { useI18n } from '../i18n';

const GROUP_URL = 'https://www.facebook.com/groups/589759677744412/';

function dash(value: string | null | undefined, missing: string) {
  const v = value?.trim();
  return v ? v : missing;
}

export function AdminFbPage() {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [added, setAdded] = useState<number | null>(null);

  const listQ = useQuery(['admin', 'fb-offers'], () => api.adminListFbOffers());

  const addMut = useMutation(
    () => api.adminImportFbOffers({ text, link: link.trim() || undefined }),
    {
      onSuccess: (res) => {
        setAdded(res.count);
        setText('');
        setLink('');
        qc.invalidateQueries(['admin', 'fb-offers']);
      },
    },
  );

  const delMut = useMutation((id: string) => api.adminDeleteFbOffer(id), {
    onSuccess: () => qc.invalidateQueries(['admin', 'fb-offers']),
  });

  const items = listQ.data?.items ?? [];
  const missing = t('admin.fbMissing');

  return (
    <div className="adminFb">
      <p className="adminFb-hint">{t('admin.fbHint')}</p>
      <a className="adminFb-group" href={GROUP_URL} target="_blank" rel="noreferrer">
        {t('admin.fbGroup')}
      </a>

      <div className="field">
        <label htmlFor="fb-paste">{t('admin.fbPaste')}</label>
        <textarea
          id="fb-paste"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAdded(null);
          }}
          placeholder={t('admin.fbHint')}
        />
      </div>
      <div className="field">
        <label htmlFor="fb-link">{t('admin.fbLink')}</label>
        <input
          id="fb-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.facebook.com/..."
          inputMode="url"
        />
      </div>
      <button
        type="button"
        className="btn btn-block"
        disabled={addMut.isLoading || text.trim().length < 12}
        onClick={() => addMut.mutate()}
      >
        {t('admin.fbAdd')}
      </button>
      {added != null && <p className="adminFb-hint">{t('admin.fbAdded', { n: added })}</p>}
      {addMut.isError && <div className="error">{(addMut.error as Error).message}</div>}

      {listQ.isLoading && <div className="empty">{t('common.loading')}</div>}
      {listQ.isError && <div className="error">{(listQ.error as Error).message}</div>}
      {listQ.data && items.length === 0 && <p className="adminFb-hint">{t('admin.fbEmpty')}</p>}

      <div className="adminFb-list">
        {items.map((row) => (
          <FbCard
            key={row.id}
            row={row}
            missing={missing}
            statusLabel={row.status === 'FULL' ? t('admin.fbFull') : t('admin.fbOpen')}
            onDelete={() => delMut.mutate(row.id)}
            labels={{
              status: t('admin.fbStatus'),
              date: t('admin.fbDate'),
              level: t('admin.fbLevel'),
              places: t('admin.fbPlaces'),
              address: t('admin.fbAddress'),
              link: t('admin.fbPostLink'),
              raw: t('admin.fbRaw'),
              remove: t('admin.fbDelete'),
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FbCard({
  row,
  missing,
  statusLabel,
  onDelete,
  labels,
}: {
  row: AdminFbOffer;
  missing: string;
  statusLabel: string;
  onDelete: () => void;
  labels: {
    status: string;
    date: string;
    level: string;
    places: string;
    address: string;
    link: string;
    raw: string;
    remove: string;
  };
}) {
  return (
    <article className={`adminFb-card ${row.status === 'FULL' ? 'isFull' : 'isOpen'}`}>
      <div className="adminFb-cardHead">
        <span className={row.status === 'FULL' ? 'tag danger' : 'tag success'}>
          {labels.status}: {statusLabel}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
          {labels.remove}
        </button>
      </div>
      <dl className="adminFb-fields">
        <div>
          <dt>{labels.date}</dt>
          <dd>{dash(row.whenLabel, missing)}</dd>
        </div>
        <div>
          <dt>{labels.level}</dt>
          <dd>{dash(row.gameLevel, missing)}</dd>
        </div>
        <div>
          <dt>{labels.places}</dt>
          <dd>{dash(row.freePlaces, missing)}</dd>
        </div>
        <div>
          <dt>{labels.address}</dt>
          <dd>{dash(row.address, missing)}</dd>
        </div>
        <div>
          <dt>{labels.link}</dt>
          <dd>
            {row.link ? (
              <a href={row.link} target="_blank" rel="noreferrer">
                {row.link}
              </a>
            ) : (
              missing
            )}
          </dd>
        </div>
      </dl>
      <details className="adminFb-raw">
        <summary>{labels.raw}</summary>
        <pre>{row.rawText}</pre>
      </details>
    </article>
  );
}
