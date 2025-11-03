const clipButton = document.getElementById("clip");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#1f2937";
}

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function waitForSerializedSelection(requestId, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;
    let listener;

    const cleanup = () => {
      if (listener) {
        chrome.runtime.onMessage.removeListener(listener);
        listener = null;
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    listener = (message) => {
      if (message?.type !== "clip-selection-serialized") {
        return;
      }

      if (requestId && message.requestId !== requestId) {
        return;
      }

      cleanup();
      resolve(message);
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for selection."));
    }, timeoutMs);

    chrome.runtime.onMessage.addListener(listener);
  });
}

function copyWithTextareaFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.top = "0";
  textarea.style.left = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!successful) {
    throw new Error("Unable to copy selection using fallback.");
  }
}

async function copySelectionToClipboard(selection) {
  if (!selection) {
    throw new Error("No text selected.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(selection);
      return;
    } catch (error) {
      console.warn("navigator.clipboard.writeText failed, falling back: ", error);
    }
  }

  try {
    copyWithTextareaFallback(selection);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}

async function clipSelectionFromPopup() {
  setStatus("Clipping selection…");

  const requestId = generateRequestId();
  const serializedSelectionPromise = waitForSerializedSelection(requestId);

  try {
    await chrome.runtime.sendMessage({ type: "clip-selection", requestId });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
    return;
  }

  try {
    const result = await serializedSelectionPromise;
    if (!result?.success) {
      setStatus(result?.error ?? "Unknown error.", true);
      return;
    }

    await copySelectionToClipboard(result.selection);

    const selectionPreview = result.selection.length > 80
      ? `${result.selection.slice(0, 77)}…`
      : result.selection;

    setStatus(selectionPreview ? `Copied: "${selectionPreview}"` : "Clipping copied to clipboard.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

clipButton.addEventListener("click", () => {
  clipSelectionFromPopup();
});
