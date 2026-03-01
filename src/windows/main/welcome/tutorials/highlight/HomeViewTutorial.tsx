import { HighlightTutorial } from "../AppHighlightTutorial";

export const HomeViewTutorial = {
  SecondMonitorCheck: {
    hltId: "home-view-second-monitor-check",
    contentPosition: 'above',
    title: "Second Monitor Support",
    content: <>
      <span>Disable this, if you want to keep the main window on a second monitor!</span>
    </>,
    clickable: true,
  },
  OpenOnStartupCheck: {
    hltId: "home-view-open-on-startup-check",
    contentPosition: 'above',
    title: "Open on startup",
    content: <>
      <span>Disable this, if you only want the main window to open manually.</span>
      <small>Otherwise it will automatically open when you start DBD!</small>
    </>,
    clickable: true,
  },
  ModeCards: {
    hltId: "home-view-mode-cards",
    contentPosition: 'below-right',
    title: "App Modes",
    content: <>
      <span>The app has different modes for the desired gameplay-loop.</span>
      <small>Currently only 1v1 is available.</small>
    </>,
    contentWidth: 400,
  },
  ToggleModeSwitch: {
    hltId: "home-view-toggle-mode-switch",
    contentPosition: 'below',
    title: "Toggle Modes",
    content: <>
      <span>You can switch between modes using the toggle or the hotkey.</span>
      <small>Click any hotkey to reassign.</small>
    </>,
    clickable: true,
  },
  LearnMoreBtn: {
    hltId: "home-view-learn-more-btn",
    contentPosition: 'below-right',
    title: "Open the tutorial",
    content: <>
      <span>Click <b>Learn More</b> on any feature to see how it works exactly!</span>
    </>
  },
  SettingsBtn: {
    hltId: "home-view-settings-btn",
    contentPosition: 'below-right',
    title: "Open the settings",
    content: <>
      <span>Jump right into the settings of a feature!</span>
    </>
  },
  CalloutCard: {
    hltId: "home-view-callout-card",
    contentPosition: 'above-right',
    title: "Callout Overlay",
    content: <>
      <span>Here you can activate the callout graphics. These are mode-idependent!</span>
    </>,
    contentWidth: 400,
  },
  SmartFeaturesCard: {
    hltId: "home-view-smart-features-card",
    contentPosition: 'above-left',
    title: "Smart Features",
    content: <>
      <span>Smart features can help you by automating certain features!</span>
      <span>Please disable them if you notice a performance issue.</span>
    </>,
    clickable: true,
    contentWidth: 400,
  },
  SmartFeaturesState: {
    hltId: "home-view-smart-features-state",
    contentPosition: 'above',
    title: "Smart Features State",
    content: <>
      Here you can see what the app thinks it's detected and why!
    </>
  },
  SmartFeaturesKiller: {
    hltId: "home-view-smart-features-killer",
    contentPosition: 'above-left',
    title: "Smart Features Killer",
    content: <>
      <span>Also you can see which killer the app thinks you're playing.</span>
      <span>The certainty upgrades over time, don't be surprised to see a wrong killer at first!</span>
    </>
  }
} as const satisfies HighlightTutorial;
