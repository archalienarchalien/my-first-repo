const articleCache = new Map();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function cacheArticle(tabId, article) {
  if (typeof tabId !== "number" || !article) {
    return;
  }

  articleCache.set(tabId, { article, cachedAt: Date.now() });
}

async function requestArticleFromTab(tabId) {
  if (typeof tabId !== "number") {
    throw new Error("Invalid tab identifier.");
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "request-article" });
    if (response?.success && response.article) {
      cacheArticle(tabId, response.article);
      return response.article;
    }

    const errorMessage = response?.error ?? "Unable to extract article.";
    throw new Error(errorMessage);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function getArticleForActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab available.");
  }

  const cached = articleCache.get(tab.id);
  if (cached?.article) {
    return cached.article;
  }

  return requestArticleFromTab(tab.id);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "clip-selection") {
    return;
  }

  try {
    await getArticleForActiveTab();
  } catch (error) {
    console.warn("Unable to fetch article for command:", error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  articleCache.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" || typeof changeInfo.url === "string") {
    articleCache.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "articleExtracted") {
    const tabId = sender?.tab?.id;
    if (tabId && message?.payload) {
      cacheArticle(tabId, message.payload);
      console.debug("Cached extracted article payload", message.payload);
    }

    try {
      sendResponse?.({ acknowledged: true });
    } catch (error) {
      console.warn("Unable to acknowledge article extraction message:", error);
    }

    return false;
  }

  if (message?.type !== "clip-article") {
    return false;
  }

  getArticleForActiveTab()
    .then((article) => {
      sendResponse({ success: true, article });
    })
    .catch((error) => {
      const messageText = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: messageText });
    });

  return true;
});
