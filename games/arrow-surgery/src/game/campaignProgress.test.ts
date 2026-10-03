import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCampaignProgress, readCampaignProgress } from './campaignProgress';
import { MAX_CAMPAIGN_LEVEL } from '../levels/campaign';

afterEach(() => vi.unstubAllGlobals());
describe('campaign progress storage', () => {
  it.each([null, 'invalid', '{}', 'null', '[]'])(
    'starts at the tutorial for missing or damaged progress: %s',
    (raw) => {
      expect(decodeCampaignProgress(raw)).toEqual({ selected: 1, completed: [] });
    },
  );
  it('restores the selected level and unique, valid completion markers', () => {
    expect(
      decodeCampaignProgress(
        JSON.stringify({
          selected: 21,
          completed: [2, 1, 2, -1, '3', 1.5, null, MAX_CAMPAIGN_LEVEL + 1],
        }),
      ),
    ).toEqual({ selected: 21, completed: [1, 2] });
  });
  it('preserves completion markers when the selected level is invalid', () => {
    expect(
      decodeCampaignProgress(
        JSON.stringify({ selected: MAX_CAMPAIGN_LEVEL + 1, completed: [1, 2] }),
      ),
    ).toEqual({ selected: 1, completed: [1, 2] });
  });
  it('works when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage unavailable');
      },
    });
    expect(readCampaignProgress()).toEqual({ selected: 1, completed: [] });
  });
});
