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
        const selection = window.getSelection();
        const selectionText = selection?.toString() ?? "";

        if (!selection || selection.isCollapsed || !selectionText.trim()) {
          return { success: false, error: "No text selected." };
        }

        try {
          if (selection.rangeCount === 0) {
            return { success: false, error: "No text selected." };
          }

          const range = selection.getRangeAt(0);
          const fragment = range.cloneContents();
          const container = document.createElement("div");
          container.appendChild(fragment);

          const blockSelector = "p, li, blockquote, h1, h2, h3, h4, h5, h6";
          const blockElements = Array.from(container.querySelectorAll(blockSelector));
          const normaliseParagraph = (text) => text.replace(/\s+/g, " ").trim();

          const paragraphs = blockElements.length
            ? blockElements
              .map((element) => normaliseParagraph(element.textContent ?? ""))
              .filter((text) => Boolean(text))
            : selectionText
              .split(/\n{2,}|\r\n{2,}/)
              .map((text) => normaliseParagraph(text))
              .filter((text) => Boolean(text));

          const images = Array.from(container.querySelectorAll("img"))
            .map((image) => ({
              alt: image.getAttribute("alt")?.trim() || "Image",
              src: image.currentSrc || image.src
            }))
            .filter((image) => Boolean(image.src));

          const authorMeta = document.querySelector("meta[name='author'], meta[property='article:author']");
          const author = authorMeta?.getAttribute("content")?.trim() || null;

          const title = (document.title ?? "").replace(/\s+/g, " ").trim() || "Untitled clipping";

          const clipping = {
            title,
            url: window.location.href,
            author,
            paragraphs,
            images
          };

          const lines = [`{{clipping}} ${clipping.title}`];
          lines.push(`\tURL:: ${clipping.url}`);

          if (clipping.author) {
            lines.push(`\t{{author}} ${clipping.author}`);
          }

          clipping.paragraphs.forEach((paragraph) => {
            lines.push(`\t${paragraph}`);
          });

          clipping.images.forEach((image) => {
            const altText = image.alt.replace(/\s+/g, " ");
            lines.push(`\t![${altText}](${image.src})`);
          });

          const tanaPaste = lines.join("\n");

          await navigator.clipboard.writeText(tanaPaste);

          return { success: true, tanaPaste, clipping };
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
