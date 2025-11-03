const statusEl = document.getElementById("status");
const TANA_SUPERTAG = "#webclip";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#1f2937";
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
    throw new Error("Unable to copy article using fallback.");
  }
}

async function copyToClipboard(text) {
  if (!text) {
    throw new Error("No article content available to copy.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn("navigator.clipboard.writeText failed, falling back:", error);
    }
  }

  copyWithTextareaFallback(text);
}

function formatArticleForTana(article) {
  if (!article) {
    throw new Error("Missing article data.");
  }

  const title = article.title?.trim() || "Untitled article";
  const author = article.author?.trim();
  const publishDate = article.publishDate?.trim();
  const sourceUrl = article.sourceUrl?.trim();
  const strategy = article.strategy?.trim();
  const bodyText = Array.isArray(article.bodyText)
    ? article.bodyText
        .map((paragraph) => (typeof paragraph === "string" ? paragraph.trim() : ""))
        .filter((paragraph) => paragraph.length > 0)
    : [];
  const images = Array.isArray(article.images)
    ? article.images
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter((url) => url.length > 0)
    : [];

  const lines = [];
  lines.push(`- ${title} ${TANA_SUPERTAG}`.trim());

  if (sourceUrl) {
    lines.push(`  - url:: ${sourceUrl}`);
  }

  if (author) {
    lines.push(`  - author:: ${author}`);
  }

  if (publishDate) {
    lines.push(`  - published:: ${publishDate}`);
  }

  if (strategy) {
    lines.push(`  - extraction strategy:: ${strategy}`);
  }

  if (bodyText.length) {
    lines.push("  - body::");
    bodyText.forEach((paragraph) => {
      lines.push(`    - ${paragraph}`);
    });
  }

  if (images.length) {
    lines.push("  - images::");
    images.forEach((url) => {
      lines.push(`    - ${url}`);
    });
  }

  return lines.join("\n");
}

async function clipArticle() {
  setStatus("Collecting article…");

  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: "clip-article" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, true);
    return;
  }

  if (!response?.success) {
    const errorMessage = response?.error ?? "Unable to retrieve article.";
    setStatus(errorMessage, true);
    return;
  }

  let formatted;
  try {
    formatted = formatArticleForTana(response.article);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, true);
    return;
  }

  try {
    await copyToClipboard(formatted);
    setStatus("Article copied for Tana paste.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  clipArticle();
});
