const clipButton = document.getElementById("clip");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#1f2937";
}

async function clipSelectionFromPopup() {
  setStatus("Clipping selection…");

  try {
    const response = await chrome.runtime.sendMessage({ type: "clip-selection" });
    if (!response?.success) {
      setStatus(response?.error ?? "Unknown error.", true);
      return;
    }

    const selectionPreview = response.selection.length > 80
      ? `${response.selection.slice(0, 77)}…`
      : response.selection;

    setStatus(`Copied: "${selectionPreview}"`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

clipButton.addEventListener("click", () => {
  clipSelectionFromPopup();
});
