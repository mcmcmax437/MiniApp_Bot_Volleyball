import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import {
  useApi,
  ApiGameDetail,
  PLAY_TYPES,
  PlayType,
  SKILL_LEVELS,
  SkillLevel,
  UpdateGamePayload,
} from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { formatGameDateTime, getAppTimeZone, utcIsoToWallClock, wallClockToUtcIso } from '../lib/datetime';
import './EditGameModal.css';

interface Props {
  open: boolean;
  game: ApiGameDetail;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export function EditGameModal({ open, game, onClose, onSaved }: Props) {
  const api = useApi();
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [playType, setPlayType] = useState<PlayType>('OUTDOOR');
  const [startWall, setStartWall] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('LEVEL_3');
  const [spotsTotal, setSpotsTotal] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVenueName(game.venue.name);
    setVenueAddress(game.venue.address);
    setPlayType(game.playType);
    setStartWall(utcIsoToWallClock(game.startAt, getAppTimeZone()));
    setSkillLevel(game.skillLevel);
    setSpotsTotal(game.spotsTotal);
    setError(null);
  }, [open, game]);

  const saveMut = useMutation(
    (patch: UpdateGamePayload) => api.updateGame(game.id, patch),
    {
      onSuccess: () => {
        qc.invalidateQueries(['game', game.id]);
        qc.invalidateQueries(['games']);
        onClose();
        onSaved?.(t('game.editDone'));
      },
      onError: (err) => {
        setError((err as Error).message || t('error.unknown'));
      },
    },
  );

  const seated = game.participantsCount;

  const handleSave = () => {
    const address = venueAddress.trim();
    if (!address) {
      setError(t('game.editAddressRequired'));
      return;
    }

    const patch: UpdateGamePayload = {};
    const name = venueName.trim();
    const venueChanged =
      address !== game.venue.address || (name && name !== game.venue.name);
    if (venueChanged) {
      patch.venueAddress = address;
      if (name) patch.venueName = name;
    }
    if (playType !== game.playType) patch.playType = playType;
    if (skillLevel !== game.skillLevel) patch.skillLevel = skillLevel;
    if (spotsTotal !== game.spotsTotal) {
      if (spotsTotal < 2) {
        setError(t('game.editSpotsMin'));
        return;
      }
      if (spotsTotal < seated) {
        setError(t('game.editSpotsBelowRoster', { n: seated }));
        return;
      }
      patch.spotsTotal = spotsTotal;
    }

    const iso = wallClockToUtcIso(startWall, getAppTimeZone());
    const next = new Date(iso).getTime();
    if (!Number.isFinite(next)) {
      setError(t('game.changeTimeInvalid'));
      return;
    }
    const timeChanged = Math.abs(next - new Date(game.startAt).getTime()) >= 60_000;
    if (timeChanged) {
      if (next < Date.now() - 60_000) {
        setError(t('game.changeTimeInvalid'));
        return;
      }
      patch.startAt = iso;
    }

    if (Object.keys(patch).length === 0) {
      setError(t('game.editNoChanges'));
      return;
    }

    setError(null);
    saveMut.mutate(patch);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saveMut.isLoading) onClose();
      }}
      title={t('game.editTitle')}
      className="modal-compact editGameModal"
    >
      <p className="editGame-current">
        {t('game.changeTimeCurrent', {
          when: formatGameDateTime(game.startAt, { locale: lang }),
        })}
      </p>
      <p className="editGame-hint">{t('game.editHint')}</p>

      <div className="field">
        <label className="field-label" htmlFor="edit-place">
          <Icon name="building-01" size={12} className="icon-inline" />
          {t('create.field.placeName')}
        </label>
        <input
          id="edit-place"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder={t('create.field.placeNamePlaceholder')}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="edit-address">
          <Icon name="map-pin" size={12} className="icon-inline" />
          {t('create.field.venueAddress')}
        </label>
        <input
          id="edit-address"
          value={venueAddress}
          onChange={(e) => setVenueAddress(e.target.value)}
          placeholder={t('create.field.venueAddressPlaceholder')}
        />
      </div>

      <div className="field">
        <label className="field-label">
          <Icon name="globe" size={12} className="icon-inline" />
          {t('create.field.playType')}
        </label>
        <div className="playTypePicker" role="radiogroup" aria-label={t('create.field.playType')}>
          {PLAY_TYPES.map((pt) => {
            const active = playType === pt;
            const iconName =
              pt === 'INDOOR' ? 'building-01' : pt === 'BEACH' ? 'tennis-ball' : 'globe';
            return (
              <button
                key={pt}
                type="button"
                role="radio"
                aria-checked={active}
                className={`playTypePicker-option${active ? ' isActive' : ''}`}
                onClick={() => setPlayType(pt)}
              >
                <Icon name={iconName} size={14} />
                <span>{t(`create.playType.${pt.toLowerCase()}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="edit-start">
          <Icon name="calendar-01" size={12} className="icon-inline" />
          {t('create.field.start')}
        </label>
        <input
          id="edit-start"
          type="datetime-local"
          value={startWall}
          onChange={(e) => setStartWall(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label">{t('create.field.skill')}</label>
        <div className="editGame-skillRow">
          {SKILL_LEVELS.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`editGame-skillChip${skillLevel === s ? ' isActive' : ''}`}
              onClick={() => setSkillLevel(s)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="edit-spots">
          <Icon name="user-group" size={12} className="icon-inline" />
          {t('create.field.spots')}
        </label>
        <input
          id="edit-spots"
          type="number"
          min={Math.max(2, seated)}
          max={1000}
          value={spotsTotal}
          onChange={(e) => setSpotsTotal(Number(e.target.value) || 0)}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          disabled={saveMut.isLoading}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={saveMut.isLoading}
          onClick={handleSave}
          data-analytics-label="game-edit-save"
        >
          {t('game.editSave')}
        </button>
      </div>
    </Modal>
  );
}
