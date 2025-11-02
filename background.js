chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    console.warn('Cannot execute content script without a valid tab ID.');
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['readability.js', 'contentScript.js']
    });
  } catch (error) {
    console.error('Failed to inject content scripts:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'articleExtracted') {
    console.info('Article extraction result from tab', sender.tab?.id, message.payload);
  }
});
