import { registerRouter, openDashboard } from '../src/messaging/router';

export default defineBackground(() => {
  registerRouter();
  // Fires only if no action popup is set; harmless otherwise.
  chrome.action.onClicked.addListener(() => {
    void openDashboard();
  });
});
