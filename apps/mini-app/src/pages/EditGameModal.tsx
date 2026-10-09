import { useEffect, useRef, useState } from 'react';
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
import { coverForPlayType } from '../lib/play-type';
import { readImageAsDataUrl } from '../lib/read-image-file';
import './EditGameModal.css';

interface Props {
  open: boolean;
  game: ApiGameDetail;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

type CoverDraft = { preview: string; base64: string; mime: string } | null;

export function EditGameModal({ open, game, onClose, onSaved }: Props) {
  const api = useApi();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [playType, setPlayType] = useState<PlayType>('OUTDOOR');
  const [startWall, setStartWall] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('LEVEL_3');
  const [spotsTotal, setSpotsTotal] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [coverDraft, setCoverDraft] = useState<CoverDraft>(null);
  const [clearCovers, setClearCovers] = useState(false);
  const [coversDirty, setCoversDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVenueName(game.venue.name);
    setVenueAddress(game.venue.address);
    setPlayType(game.playType);
    setStartWall(utcIsoToWallClock(game.startAt, getAppTimeZone()));
    setSkillLevel(game.skillLevel);
    setSpotsTotal(game.spotsTotal);
    setError(null);
    setCoverDraft(null);
    setClearCovers(false);
    setCoversDirty(false);
  }, [open, game]);

  const preview =
    coverDraft?.preview ??
    (!clearCovers && game.coverImageUrl ? game.coverImageUrl : null);

  const saveMut = useMutation(
    async (patch: UpdateGamePayload) => {
      let updated = game;
      if (Object.keys(patch).length > 0) {
        updated = await api.updateGame(game.id, patch);
      }
      if (clearCovers) {
        updated = await api.clearGameCovers(game.id);
      } else if (coverDraft) {
        updated = await api.setGameCovers(game.id, {
          images: [{ base64: coverDraft.base64, mime: coverDraft.mime }],
        });
      }
      return updated;
    },
    {
      onSuccess: () => {
        qc.invalidateQueries(['game', game.id]);
        qc.invalidateQueries(['games']);
        qc.invalidateQueries(['me']);
        onClose();
        onSaved?.(t('game.editDone'));
      },
      onError: (err) => {
        setError((err as Error).message || t('error.unknown'));
      },
    },
  );

  const seated = game.participantsCount + (game.reservedCount ?? 0);

  const pickCover = async (file: File | null) => {
    if (!file) return;
    try {
      const { base64, mime } = await readImageAsDataUrl(file);
      setCoverDraft({ preview: base64, base64, mime });
      setClearCovers(false);
      setCoversDirty(true);
      setError(null);
    } catch (err) {
      setError((err as Error).message || t('error.unknown'));
    }
  };

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

    if (Object.keys(patch).length === 0 && !coversDirty && !clearCovers) {
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

      <div className="field">
        <label className="field-label">
          <Icon name="image-01" size={12} className="icon-inline" />
          {t('game.coversTitle')}
        </label>
        <p className="editGame-hint" style={{ marginTop: 0 }}>
          {t('game.coversHint')}
        </p>
        <div className="editGame-covers editGame-covers-single">
          <button
            type="button"
            className="editGame-coverSlot"
            onClick={() => fileRef.current?.click()}
            data-analytics-label="game-cover"
          >
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <span>
                <Icon name="plus-sign" size={18} />
                {t('game.coversAdd')}
              </span>
            )}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            void pickCover(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {(preview || game.coverImageUrl || game.coverImageUrl2) && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              setCoverDraft(null);
              setClearCovers(true);
              setCoversDirty(true);
            }}
          >
            {t('game.coversClear')}
          </button>
        )}
        {!preview && (
          <div className="editGame-coverFallback">
            <img src={coverForPlayType(playType)} alt="" />
            <span>{t('create.field.coverPreviewHint')}</span>
          </div>
        )}
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
