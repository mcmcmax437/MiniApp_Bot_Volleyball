import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  useApi,
  SkillLevel,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  Currency,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
} from '../api';
import { useI18n } from '../i18n';
import { Icon, IconName } from '../Icon';
import './CreateGame.css';

const SKILL_ICONS: Record<SkillLevel, IconName> = {
  LEVEL_1: 'tennis-ball',
  LEVEL_2: 'play',
  LEVEL_3: 'medal-01',
  LEVEL_4: 'award-01',
  LEVEL_5: 'star',
  LEVEL_6: 'crown',
};

function toIsoLocal(value: string): string {
  return new Date(value).toISOString();
}

function defaultStartAt(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 24);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateGamePage() {
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  useQuery(['me'], () => api.me());
  const cityQ = useQuery(['default-city'], () => api.defaultCity());
  const venuesQ = useQuery(['venues', cityQ.data?.city], () =>
    api.listVenues({ city: cityQ.data?.city ?? undefined }),
  );

  const [venueId, setVenueId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [startAt, setStartAt] = useState(defaultStartAt());
  const [durationHours, setDurationHours] = useState<number | ''>(2);
  const [skill, setSkill] = useState<SkillLevel>('LEVEL_3');
  // 0 = unlimited. We use 0 because the field minimum is 1 in HTML, but we
  // show a toggle that flips to "unlimited" and clears the cap.
  const [unlimitedSpots, setUnlimitedSpots] = useState(false);
  const [spotsTotal, setSpotsTotal] = useState(10);
  const [currency, setCurrency] = useState<Currency>('PLN');
  // cost is stored as decimal in major units (e.g. 25.00)
  const [totalCostDecimal, setTotalCostDecimal] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [addressHint, setAddressHint] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  const selectedVenue = useMemo(
    () => venuesQ.data?.find((v) => v.id === venueId),
    [venuesQ.data, venueId],
  );

  const [costTouched, setCostTouched] = useState(false);
  const suggestedCostDecimal = selectedVenue
    ? ((selectedVenue.hourlyPrice * (durationHours === '' ? 1 : durationHours)) / 100).toFixed(2)
    : '0.00';
  const finalCostDecimal = costTouched ? totalCostDecimal : suggestedCostDecimal;
  // `isPaid` is no longer user-toggled. It is derived from the total cost:
  // a game is paid when the organizer enters a non-zero amount. Leaving the
  // cost at zero means the game is free.
  const isPaid = Number(finalCostDecimal) > 0;
  const perPlayer = unlimitedSpots
    ? (Number(finalCostDecimal) || 0).toFixed(2)
    : spotsTotal > 0
      ? ((Number(finalCostDecimal) || 0) / spotsTotal).toFixed(2)
      : '0.00';

  const endAtIso = useMemo(() => {
    const start = new Date(toIsoLocal(startAt));
    const hours = durationHours === '' ? 1 : durationHours;
    const end = new Date(start.getTime() + hours * 3600_000);
    return end.toISOString();
  }, [startAt, durationHours]);

  // When user toggles "unlimited", snap to a sane max. We let the API accept
  // up to 1000 spots; the field is capped at the same.
  useEffect(() => {
    if (unlimitedSpots && spotsTotal < 100) setSpotsTotal(100);
  }, [unlimitedSpots]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMut = useMutation(
    () =>
      api.createGame({
        venueId: venueId || undefined,
        venueName: venueName.trim() || undefined,
        venueAddress: venueAddress.trim(),
        startAt: toIsoLocal(startAt),
        endAt: endAtIso,
        skillLevel: skill,
        spotsTotal: unlimitedSpots ? 1000 : spotsTotal,
        totalCost: Math.round((Number(finalCostDecimal) || 0) * 100),
        notes: notes || undefined,
        currency,
        isPaid,
        isClosed,
        coverImageUrl: coverImageUrl.trim() || undefined,
        addressHint: addressHint.trim() || undefined,
      }),
    {
      onSuccess: (g) => {
        qc.invalidateQueries(['games']);
        navigate(`/games/${g.id}`);
      },
    },
  );

  if (venuesQ.isLoading) {
    return (
      <div className="createPage">
        <div className="skeleton" style={{ width: '60%', height: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 48, marginBottom: 16, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: '100%', height: 48, marginBottom: 16, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
      </div>
    );
  }

  const canSubmit = !!venueAddress.trim() && !createMut.isLoading;

  return (
    <form
      className="createForm"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) createMut.mutate();
      }}
    >
      <header className="createHeader">
        <div className="createHeader-icon">
          <Icon name="plus-sign" size={20} />
        </div>
        <div>
          <h1 className="createHeader-title">{t('create.title')}</h1>
          <p className="createHeader-sub">{t('create.subtitle')}</p>
        </div>
      </header>

      {/* Where */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">1</span>
          {t('create.section.where')}
        </h2>
        <div className="field">
          <label className="field-label" htmlFor="venue">
            <Icon name="building-01" size={12} className="icon-inline" />
            {t('create.field.savedPlaces')}
          </label>
          {/* Native <select> elements render inconsistently across iOS Safari
              and Android WebView and are easy to miss on small phones. We
              render a tappable card list instead, with the same accessibility
              surface (radiogroup / aria-checked). */}
          <div
            className="venuePicker"
            role="radiogroup"
            aria-label={t('create.field.savedPlaces')}
          >
            {(venuesQ.data ?? []).length === 0 && (
              <div className="venuePicker-empty">{t('create.field.noSavedPlaces')}</div>
            )}
            {venuesQ.data?.map((v) => {
              const active = v.id === venueId;
              return (
                <button
                  type="button"
                  key={v.id}
                  role="radio"
                  aria-checked={active}
                  className={`venuePicker-item ${active ? 'isActive' : ''}`}
                  onClick={() => {
                    setVenueId(v.id);
                    setVenueName(v.name);
                    setVenueAddress(v.address);
                  }}
                  data-analytics-label={`create-venue-${v.id}`}
                >
                  <span className="venuePicker-icon">
                    <Icon name={v.indoor ? 'building-01' : 'maps'} size={16} />
                  </span>
                  <span className="venuePicker-info">
                    <span className="venuePicker-name">{v.name}</span>
                    <span className="venuePicker-meta">
                      {v.address}
                    </span>
                  </span>
                  <span className="venuePicker-price">
                    {active ? <Icon name="checkmark-square-01" size={14} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedVenue && (
            <div className="venueSelected" style={{ display: 'none' }} aria-hidden="true">
              <div className="venueSelected-icon">
                <Icon name={selectedVenue.indoor ? 'building-01' : 'maps'} size={16} />
              </div>
              <div className="venueSelected-info">
                <div className="venueSelected-name">{selectedVenue.name}</div>
                <div className="venueSelected-meta">
                  <span className="tag info">{selectedVenue.indoor ? 'Indoor' : 'Outdoor'}</span>
                  <span className="tag">Up to {selectedVenue.capacity} players</span>
                  <span className="venueSelected-price">
                    {CURRENCY_SYMBOLS[currency]}{(selectedVenue.hourlyPrice / 100).toFixed(2)} / hr
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="venueName">
            <Icon name="building-01" size={12} className="icon-inline" />
            {t('create.field.placeName')}
          </label>
          <input
            id="venueName"
            value={venueName}
            onChange={(e) => {
              setVenueId('');
              setVenueName(e.target.value);
            }}
            placeholder={t('create.field.placeNamePlaceholder')}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="address">
            <Icon name="map-pin" size={12} className="icon-inline" />
            {t('create.field.venueAddress')}
          </label>
          <input
            id="address"
            value={venueAddress}
            onChange={(e) => {
              setVenueId('');
              setVenueAddress(e.target.value);
            }}
            placeholder={t('create.field.venueAddressPlaceholder')}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="addressHint">
            <Icon name="pin" size={12} className="icon-inline" />
            {t('create.field.addressHint')}
          </label>
          <input
            id="addressHint"
            value={addressHint}
            onChange={(e) => setAddressHint(e.target.value)}
            placeholder={t('create.field.addressHintPlaceholder')}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cover">
            <Icon name="image-01" size={12} className="icon-inline" />
            {t('create.field.coverImage')}
          </label>
          <input
            id="cover"
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://maps.googleapis.com/..."
          />
          {coverImageUrl && (
            <div className="coverPreview" style={{ marginTop: 8 }}>
              <img src={coverImageUrl} alt="cover preview" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            </div>
          )}
        </div>
      </section>

      {/* When */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">2</span>
          {t('create.section.when')}
        </h2>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="start">
              <Icon name="calendar-01" size={12} className="icon-inline" />
              {t('create.field.start')}
            </label>
            <input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="field field-duration">
            <label className="field-label" htmlFor="duration">
              <Icon name="clock-01" size={12} className="icon-inline" />
              {t('create.field.duration')}
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              max={6}
              value={durationHours === '' ? '' : durationHours}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setDurationHours('');
                  return;
                }
                const n = Number(v);
                if (!Number.isNaN(n)) setDurationHours(Math.min(6, Math.max(1, n)));
              }}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 1) setDurationHours(1);
              }}
            />
          </div>
        </div>
      </section>

      {/* Who */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">3</span>
          {t('create.section.who')}
        </h2>

        <div className="field">
          <label className="field-label">
            <Icon name="award-01" size={12} className="icon-inline" />
            {t('create.field.skill')}
          </label>
          {/* Skill chip grid replaces the previously-broken tap handler. Each
              chip is its own button; no race condition between hover / focus
              and the click handler. */}
          <div className="skillChipGrid" role="radiogroup" aria-label="Skill level">
            {SKILL_LEVELS.map((s, i) => (
              <button
                type="button"
                key={s}
                role="radio"
                aria-checked={skill === s}
                className={`skillChip ${skill === s ? 'isActive' : ''}`}
                onClick={() => setSkill(s)}
                data-analytics-label={`create-skill-${s}`}
              >
                <span className="skillChip-icon">
                  <Icon name={SKILL_ICONS[s]} size={14} />
                </span>
                <span className="skillChip-num">{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 6 }}>
            {SKILL_LEVEL_LABELS[skill]}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="spots">
            <Icon name="user-group" size={12} className="icon-inline" />
            {t('create.field.spots')}
          </label>

          <div className="spotsWrap">
            <div className="spotsStepper">
              <button
                type="button"
                className="stepperBtn"
                onClick={() => setSpotsTotal((s) => Math.max(2, s - 1))}
                disabled={unlimitedSpots}
                aria-label="Decrease spots"
              >
                <Icon name="arrow-down-01" size={14} />
              </button>
              <input
                id="spots"
                type="number"
                min={2}
                max={1000}
                value={unlimitedSpots ? '∞' : spotsTotal}
                disabled={unlimitedSpots}
                onChange={(e) =>
                  setSpotsTotal(Math.max(2, Math.min(1000, Number(e.target.value) || 2)))
                }
                className="stepperInput"
              />
              <button
                type="button"
                className="stepperBtn"
                onClick={() => setSpotsTotal((s) => Math.min(1000, s + 1))}
                disabled={unlimitedSpots}
                aria-label="Increase spots"
              >
                <Icon name="arrow-up-01" size={14} />
              </button>
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={unlimitedSpots}
                onChange={(e) => setUnlimitedSpots(e.target.checked)}
              />
              <span className="toggle-track" />
              <span className="toggle-label">{t('create.field.unlimited')}</span>
            </label>
          </div>
          {selectedVenue && !unlimitedSpots && (
            <div className="field-hint">
              {t('create.venueMax', { n: selectedVenue.capacity })}
            </div>
          )}
          {unlimitedSpots && <div className="field-hint">{t('create.unlimitedHint')}</div>}
        </div>
      </section>

      {/* Cost */}
      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">4</span>
          {t('create.section.cost')}
        </h2>

        <div className="field">
          <label className="field-label" htmlFor="currency">
            <Icon name="dollar-01" size={12} className="icon-inline" />
            {t('create.field.currency')}
          </label>
          <select
            id="currency"
            className="costInput-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            style={{ width: '100%' }}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOLS[c]} {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cost">
            <Icon name="dollar-01" size={12} className="icon-inline" />
            {t('create.field.totalCost')}
          </label>
          <div className="costInput-row">
            <input
              id="cost"
              type="text"
              inputMode="decimal"
              value={finalCostDecimal}
              onChange={(e) => {
                setCostTouched(true);
                // Allow empty and decimal-only; we parse on submit.
                const v = e.target.value.replace(',', '.');
                if (/^\d*\.?\d{0,2}$/.test(v)) setTotalCostDecimal(v);
                else if (v === '') setTotalCostDecimal('');
              }}
              placeholder={suggestedCostDecimal}
            />
            <span className="costInput-currency" style={{ minWidth: 48 }}>
              {CURRENCY_SYMBOLS[currency]}
            </span>
          </div>
          <div className="field-hint">
            {costTouched
              ? t('create.cost.custom')
              : selectedVenue
                ? t('create.cost.auto', { venue: selectedVenue.name, hours: durationHours === '' ? 1 : durationHours })
                : t('create.cost.manual')}
          </div>
        </div>

        <label className="toggle" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={isClosed}
            onChange={(e) => setIsClosed(e.target.checked)}
          />
          <span className="toggle-track" />
          <span className="toggle-label">{t('create.field.closed')}</span>
        </label>

        <div
          className={`paidBadge ${isPaid ? 'paidBadge-paid' : 'paidBadge-free'}`}
          aria-live="polite"
        >
          <Icon name={isPaid ? 'credit-card' : 'gift'} size={14} />
          <span>
            {isPaid
              ? t('create.paidStatus.on')
              : t('create.paidStatus.off')}
          </span>
        </div>

        <div className="costSummary">
          <div className="costRow">
            <span className="costSummary-label">{t('payments.perPlayer')}</span>
            <strong>
              {CURRENCY_SYMBOLS[currency]}
              {perPlayer}
            </strong>
          </div>
          {!unlimitedSpots && (
            <div className="costRow">
              <span className="costSummary-label">{t('create.splitBetween', { n: spotsTotal })}</span>
            </div>
          )}
        </div>
      </section>

      <section className="formSection">
        <h2 className="formSection-title">
          <span className="formSection-num">5</span>
          {t('create.section.notes')}
        </h2>
        <div className="field">
          <label className="field-label" htmlFor="notes">
            <Icon name="note-01" size={12} className="icon-inline" />
            {t('common.optional')}
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bring a light/dark shirt for teams"
          />
        </div>
      </section>

      {createMut.isError && (
        <div className="error">
          <Icon name="bell-dot" size={16} />
          <span>{(createMut.error as Error).message}</span>
        </div>
      )}

      <button type="submit" className="btn" disabled={!canSubmit}>
        <Icon name="plus-sign" size={18} />
        {createMut.isLoading ? t('create.cta.creating') : t('create.cta')}
      </button>
    </form>
  );
}
