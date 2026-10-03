import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCheck, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { campaignInput, isCampaignLevel, MAX_CAMPAIGN_LEVEL } from '../levels/campaign';

const PAGE_SIZE = 25;
const difficultyNames = { easy: 'Easy', hard: 'Hard', 'super-hard': 'Super hard' };

export function LevelPicker({
  selected,
  completed,
  saved,
  onSelect,
  onCustom,
  onClose,
}: {
  selected: number;
  completed: number[];
  saved: boolean;
  onSelect: (number: number) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(Math.floor((selected - 1) / PAGE_SIZE));
  const [jump, setJump] = useState(String(selected));
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(MAX_CAMPAIGN_LEVEL, first + PAGE_SIZE - 1);
  return (
    <Modal title="Choose a level" onClose={onClose} className="level-picker-modal">
      <div className="campaign-level-list">
        {Array.from({ length: last - first + 1 }, (_, i) => {
          const number = first + i;
          const input = number === 1 ? null : campaignInput(number);
          return (
            <button
              autoFocus={number === selected}
              key={number}
              className={number === selected ? 'selected' : ''}
              aria-current={number === selected ? 'true' : undefined}
              onClick={() => onSelect(number)}
            >
              <span className="campaign-number">{String(number).padStart(2, '0')}</span>
              <span>
                <strong>{number === 1 ? 'First moves' : `Level ${number}`}</strong>
                <small>
                  {input
                    ? `${input.columns} × ${input.rows} · ${difficultyNames[input.difficulty!]}`
                    : 'Tutorial · 3 arrows'}
                </small>
              </span>
              {completed.includes(number) ? (
                <CheckCheck size={20} aria-label="Completed" />
              ) : (
                <ArrowRight size={18} />
              )}
            </button>
          );
        })}
      </div>
      <div className="campaign-pages">
        <button
          aria-label="Previous levels"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={18} />
        </button>
        <span aria-live="polite">
          {first}–{last}
        </span>
        <button
          aria-label="More levels"
          disabled={last === MAX_CAMPAIGN_LEVEL}
          onClick={() => setPage(page + 1)}
        >
          <ArrowRight size={18} />
        </button>
      </div>
      <form
        className="campaign-jump"
        onSubmit={(event) => {
          event.preventDefault();
          if (isCampaignLevel(Number(jump))) onSelect(Number(jump));
        }}
      >
        <label htmlFor="campaign-level-number">Level</label>
        <input
          id="campaign-level-number"
          type="number"
          min={1}
          max={MAX_CAMPAIGN_LEVEL}
          step={1}
          required
          value={jump}
          onChange={(event) => setJump(event.target.value)}
        />
        <button className="secondary-button" disabled={!isCampaignLevel(Number(jump))}>
          Play
        </button>
      </form>
      <button className="campaign-custom secondary-button" onClick={onCustom}>
        <Sparkles size={17} /> Create a custom puzzle
      </button>
      {!saved && (
        <p className="generation-error" role="status">
          Progress could not be saved on this device.
        </p>
      )}
    </Modal>
  );
}
