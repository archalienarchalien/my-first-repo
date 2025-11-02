async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function clipSelection(tabId) {
  if (typeof tabId !== "number") {
    return { success: false, error: "Invalid tab identifier." };
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const selection = window.getSelection()?.toString() ?? "";
        if (!selection) {
          return { success: false, error: "No text selected." };
        }

        try {
          await navigator.clipboard.writeText(selection);
          return { success: true, selection };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });

    return injection?.result ?? { success: false, error: "Unable to clip selection." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handleClipRequest() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return { success: false, error: "No active tab available." };
  }

  return clipSelection(tab.id);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "clip-selection") {
    return;
  }

  const result = await handleClipRequest();
  if (!result.success) {
    console.warn("Clip command failed:", result.error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "clip-selection") {
    return;
  }

  handleClipRequest().then(sendResponse);
  return true;
});
