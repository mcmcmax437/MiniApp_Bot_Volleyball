import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApi } from '../api';
import { useI18n } from '../i18n';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { Photo } from '../Photo';

interface Props {
  open: boolean;
  gameId: string;
  onClose: () => void;
}

export function InvitePlayerModal({ open, gameId, onClose }: Props) {
  const api = useApi();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [telegramId, setTelegramId] = useState('');

  const gameQ = useQuery(['game', gameId], () => api.getGame(gameId), { enabled: open });
  const inviteMut = useMutation(
    () => api.invitePlayer(gameId, telegramId.trim()),
    {
      onSuccess: () => {
        setTelegramId('');
        qc.invalidateQueries(['game', gameId]);
      },
    },
  );

  const currentIds = new Set<string>();
  if (gameQ.data) {
    currentIds.add(gameQ.data.host.id);
    gameQ.data.participants.forEach((p) => currentIds.add(p.userId));
    gameQ.data.invitations?.forEach((i) => currentIds.add(i.userId));
  }

  return (
    <Modal open={open} onClose={onClose} title={t('invite.invitePlayer')}>
      <div className="field">
        <label className="field-label">Telegram ID</label>
        <input
          type="text"
          inputMode="numeric"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          placeholder="123456789"
        />
        <div className="field-hint">
          Ask the player for their Telegram ID, or look them up by username.
        </div>
      </div>
      {inviteMut.isError && (
        <div className="error">
          <Icon name="bell-dot" size={14} />
          <span>{(inviteMut.error as Error).message}</span>
        </div>
      )}
      {inviteMut.isSuccess && (
        <div className="success-banner">
          <Icon name="checkmark-square-01" size={14} />
          <span>{t('invite.invited')}</span>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          <Icon name="cancel-01" size={14} />
          {t('common.cancel')}
        </button>
        <button
          className="btn"
          onClick={() => inviteMut.mutate()}
          disabled={!telegramId.trim() || inviteMut.isLoading}
        >
          <Icon name="mail-01" size={14} />
          {t('invite.invitePlayer')}
        </button>
      </div>

      {gameQ.data?.invitations && gameQ.data.invitations.length > 0 && (
        <>
          <div className="formSection-title" style={{ marginTop: 18 }}>
            <span className="formSection-num"><Icon name="message-01" size={12} /></span>
            Pending
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gameQ.data.invitations.map((inv) => {
              const u = gameQ.data!.participants.find((p) => p.userId === inv.userId)?.user
                ?? gameQ.data!.participants.find((p) => p.userId === inv.userId)?.user;
              return (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Photo src={null} name={`#${inv.userId.slice(-4)}`} size={28} />
                  <span style={{ flex: 1, fontSize: 13 }}>
                    Invitation pending
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
