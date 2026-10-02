export interface AdResult {
  platform?: string;
  shown: boolean;
  rewarded: boolean;
  reason: string;
  requestId?: string;
}
export interface AdRequest {
  gameId?: string;
  placement?: string;
  roundId?: string;
  requestId?: string;
}
export interface AdInfo {
  apiVersion?: number;
  version?: string;
  platform: string;
  enabled: boolean;
  busy?: boolean;
  quarantined?: boolean;
  capabilities: {interstitial: boolean; rewarded: boolean};
}
export interface Ads {
  ready(): Promise<AdInfo>;
  info(): AdInfo;
  afterRound(options?: AdRequest): Promise<AdResult>;
  rewarded(options?: AdRequest): Promise<AdResult>;
}
declare global {
  interface Window {
    JarvisAdsReady: Promise<Ads>;
    JarvisAds?: Ads;
  }
}
