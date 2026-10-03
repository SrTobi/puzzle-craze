import { isCampaignLevel } from '../levels/campaign';

export const CAMPAIGN_STORAGE_KEY = 'arrow-surgery:campaign:v1';
export interface CampaignProgress {
  selected: number;
  completed: number[];
}

export function decodeCampaignProgress(raw: string | null): CampaignProgress {
  try {
    const value = JSON.parse(raw ?? 'null');
    return {
      selected: isCampaignLevel(value?.selected) ? value.selected : 1,
      completed: Array.isArray(value?.completed)
        ? [...new Set<number>(value.completed.filter(isCampaignLevel))].sort((a, b) => a - b)
        : [],
    };
  } catch {
    return { selected: 1, completed: [] };
  }
}

export function readCampaignProgress(): CampaignProgress {
  try {
    return decodeCampaignProgress(localStorage.getItem(CAMPAIGN_STORAGE_KEY));
  } catch {
    return decodeCampaignProgress(null);
  }
}
