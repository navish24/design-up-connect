import { Platform } from 'react-native';

const MIXPANEL_TOKEN = '2a7edc18cc3c9588ae8a4c7e7db8e7ab';

// ── Web: mixpanel-browser ─────────────────────────────────────────────────────
let webMixpanel: any = null;
if (Platform.OS === 'web') {
  import('mixpanel-browser').then((m) => {
    const mp = m.default ?? m;
    mp.init(MIXPANEL_TOKEN, { persistence: 'localStorage', ignore_dnt: true });
    webMixpanel = mp;
  }).catch(() => {});
}

// ── Native: mixpanel-react-native ─────────────────────────────────────────────
let nativeMixpanel: any = null;
if (Platform.OS !== 'web') {
  try {
    const { Mixpanel } = require('mixpanel-react-native');
    nativeMixpanel = new Mixpanel(MIXPANEL_TOKEN, true);
    nativeMixpanel.init();
  } catch {
    nativeMixpanel = null;
  }
}

const track = (event: string, props?: Record<string, unknown>) => {
  if (Platform.OS === 'web') {
    webMixpanel?.track(event, props);
  } else {
    nativeMixpanel?.track(event, props);
  }
};

export const Analytics = {
  identify(userId: string, props?: { name?: string; email?: string; phone?: string; profession?: string; company?: string }) {
    if (Platform.OS === 'web') {
      if (!webMixpanel) return;
      webMixpanel.identify(userId);
      if (props) webMixpanel.people.set({ $name: props.name, $email: props.email, phone: props.phone, profession: props.profession, company: props.company });
    } else {
      if (!nativeMixpanel) return;
      nativeMixpanel.identify(userId);
      if (props) nativeMixpanel.getPeople().set({ $name: props.name, $email: props.email, phone: props.phone, profession: props.profession, company: props.company });
    }
  },

  reset() {
    if (Platform.OS === 'web') webMixpanel?.reset();
    else nativeMixpanel?.reset();
  },

  signInStarted(method: 'google' | 'email') {
    track('sign_in_started', { method });
  },

  signInCompleted(method: 'google' | 'email', isNewUser: boolean) {
    track('sign_in_completed', { method, is_new_user: isNewUser });
  },

  profileSetupCompleted(props: { profession: string; company: string; hasPhone: boolean }) {
    track('profile_setup_completed', props);
  },

  qrScanned(type: 'booth' | 'user' | 'exhibition' | 'unknown') {
    track('qr_scanned', { type });
  },

  connectionMade(props: { isFirstConnection: boolean }) {
    track('connection_made', props);
  },

  cardScanned(success: boolean) {
    track('card_scanned', { success });
  },

  tabViewed(tab: 'home' | 'scan' | 'connections' | 'profile') {
    const labels: Record<string, string> = {
      home: 'Home Tab Viewed',
      scan: 'Scan Tab Viewed',
      connections: 'Connections Tab Viewed',
      profile: 'Profile Tab Viewed',
    };
    track(labels[tab] ?? 'Tab Viewed', { tab });
  },

  screenViewed(screen: string) {
    track('screen_viewed', { screen });
  },

  editDetailsTapped() {
    track('Edit Details Tapped');
  },

  previewCardTapped() {
    track('Preview Card Tapped');
  },

  shareQRTapped() {
    track('Share QR Tapped');
  },

  inviteToConnectTapped() {
    track('Invite to Connect Tapped');
  },

  exchangeContactTapped(context: 'list' | 'detail') {
    track('Exchange Contact Tapped', { context });
  },

  captureCardTapped() {
    track('Capture Card Tapped');
  },

  contactIconTapped(icon: 'whatsapp' | 'call' | 'email' | 'linkedin' | 'instagram' | 'website' | 'copy') {
    track('Contact Icon Tapped', { icon });
  },

  qrExpanded() {
    track('QR Expanded');
  },

  cardContactSaved() {
    track('Card Contact Saved');
  },

  cardContactDiscarded() {
    track('Card Contact Discarded');
  },

  galleryImportTapped() {
    track('Gallery Import Tapped');
  },

  profileSaved() {
    track('Profile Saved');
  },

  helpSupportOpened() {
    track('Help & Support Opened');
  },

  supportQuerySubmitted() {
    track('Support Query Submitted');
  },

  signedOut() {
    track('Signed Out');
  },

  noteAdded() {
    track('Note Added');
  },

  connectionSearched(query: string) {
    track('Connection Searched', { query_length: query.length });
  },

  linkBrandTapped() {
    track('Link Brand Tapped');
  },

  qrLandingViewed(viewedUserId: string) {
    track('qr_landing_viewed', { viewed_user_id: viewedUserId });
  },

  addOnConnectTapped(viewedUserId: string) {
    track('add_on_connect_tapped', { viewed_user_id: viewedUserId });
  },

  getTheAppTapped() {
    track('get_the_app_tapped');
  },

  otpResendTapped() {
    track('otp_resend_tapped');
  },
};
