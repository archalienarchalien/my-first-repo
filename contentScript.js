(function () {
  function whenReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => callback(), { once: true });
    } else {
      callback();
    }
  }

  function findMainArticle() {
    const directArticle = document.querySelector('article');
    if (directArticle) {
      return { element: directArticle, metadata: null, strategy: 'article' };
    }

    const main = document.querySelector('main');
    if (main) {
      const nestedArticle = main.querySelector('article');
      return { element: nestedArticle || main, metadata: null, strategy: nestedArticle ? 'main-article' : 'main' };
    }

    if (typeof Readability === 'function') {
      try {
        const cloned = document.cloneNode(true);
        const reader = new Readability(cloned);
        const parsed = reader.parse();
        if (parsed) {
          const readabilityDoc = document.implementation.createHTMLDocument('Readability Article');
          readabilityDoc.body.innerHTML = parsed.content || '';
          return {
            element: readabilityDoc.body,
            metadata: parsed,
            strategy: 'readability'
          };
        }
      } catch (error) {
        console.warn('Readability parsing failed:', error);
      }
    }

    return { element: document.body, metadata: null, strategy: 'body' };
  }

  function toAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      return new URL(url, window.location.href).href;
    } catch (error) {
      return null;
    }
  }

  function extractFromMeta(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (node) {
        const value = node.getAttribute('content') || node.getAttribute('datetime') || node.textContent;
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }
    return null;
  }

  function extractAuthorFromMeta(element) {
    const metaSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="parsely-author"]',
      'meta[name="sailthru.author"]',
      'meta[name="byl"]',
      'meta[name="dcterms.creator"]',
      'meta[name="dc.creator"]',
      'meta[property="og:article:author"]'
    ];
    const globalAuthor = extractFromMeta(metaSelectors);
    if (globalAuthor) {
      return globalAuthor;
    }

    const itemPropAuthor = element.querySelector('[itemprop="author"], [rel="author"], .author, .byline');
    if (itemPropAuthor) {
      const text = itemPropAuthor.textContent;
      if (text && text.trim()) {
        return text.trim();
      }
    }

    return null;
  }

  function extractPublishDate(element) {
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="publishdate"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
      'meta[name="parsely-pub-date"]',
      'meta[itemprop="datePublished"]'
    ];
    const globalDate = extractFromMeta(metaSelectors);
    if (globalDate) {
      return globalDate;
    }

    const timeElement = element.querySelector('time[datetime]');
    if (timeElement?.dateTime) {
      return timeElement.dateTime;
    }

    const textTime = timeElement?.textContent?.trim();
    return textTime || null;
  }

  function getHeadingTitle(element) {
    const heading = element.querySelector('h1, h2, h3');
    if (heading) {
      const text = heading.textContent;
      if (text && text.trim()) {
        return text.trim();
      }
    }
    return null;
  }

  function extractTitleFromMeta() {
    const titleSelectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="parsely-title"]',
      'meta[name="sailthru.title"]',
      'meta[itemprop="headline"]'
    ];
    const metaTitle = extractFromMeta(titleSelectors);
    return metaTitle || document.title;
  }

  function parseAuthor(authorField) {
    if (!authorField) {
      return null;
    }

    if (typeof authorField === 'string') {
      return authorField.trim();
    }

    if (Array.isArray(authorField)) {
      for (const author of authorField) {
        const parsed = parseAuthor(author);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (typeof authorField === 'object') {
      if (Array.isArray(authorField.name)) {
        return authorField.name.map((name) => String(name).trim()).filter(Boolean).join(', ');
      }
      if (authorField.name) {
        return String(authorField.name).trim();
      }
      if (authorField['@type'] && typeof authorField['@type'] === 'string') {
        const possibleName = authorField.text || authorField.fullName;
        if (possibleName) {
          return String(possibleName).trim();
        }
      }
    }

    return null;
  }

  function collectStructuredData() {
    const structured = { images: [] };
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

    const articleTypes = new Set(['Article', 'NewsArticle', 'BlogPosting', 'Report', 'AnalysisNewsArticle']);

    for (const script of scripts) {
      let jsonText = script.textContent;
      if (!jsonText) {
        continue;
      }

      jsonText = jsonText.trim();
      if (!jsonText) {
        continue;
      }

      let data;
      try {
        data = JSON.parse(jsonText);
      } catch (error) {
        continue;
      }

      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const types = item['@type'];
        const typeList = Array.isArray(types) ? types : [types];
        if (!typeList.some((type) => typeof type === 'string' && articleTypes.has(type))) {
          continue;
        }

        if (!structured.title && typeof item.headline === 'string') {
          structured.title = item.headline.trim();
        }

        if (!structured.author) {
          const author = parseAuthor(item.author || item.creator || item.authorName);
          if (author) {
            structured.author = author;
          }
        }

        if (!structured.publishDate && typeof item.datePublished === 'string') {
          structured.publishDate = item.datePublished.trim();
        }

        if (item.image) {
          const images = Array.isArray(item.image) ? item.image : [item.image];
          for (const image of images) {
            if (typeof image === 'string') {
              const absolute = toAbsoluteUrl(image);
              if (absolute) {
                structured.images.push(absolute);
              }
            } else if (image && typeof image === 'object' && typeof image.url === 'string') {
              const absolute = toAbsoluteUrl(image.url);
              if (absolute) {
                structured.images.push(absolute);
              }
            }
          }
        }
      }
    }

    structured.images = Array.from(new Set(structured.images));
    return structured;
  }

  function collectBodyText(element) {
    const selectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, li';
    const blocks = [];

    const elements = element.querySelectorAll(selectors);
    for (const node of elements) {
      if (node.closest('figure, nav, header, footer, aside')) {
        continue;
      }
      const text = node.textContent;
      if (text) {
        const trimmed = text.replace(/\s+/g, ' ').trim();
        if (trimmed) {
          blocks.push(trimmed);
        }
      }
    }

    return Array.from(new Set(blocks));
  }

  function collectImages(element, initial = []) {
    const imageUrls = new Set(initial);
    const images = element.querySelectorAll('img');
    images.forEach((img) => {
      const candidates = [img.currentSrc, img.src, img.getAttribute('data-src'), img.getAttribute('data-original')];
      for (const candidate of candidates) {
        const absolute = toAbsoluteUrl(candidate);
        if (absolute) {
          imageUrls.add(absolute);
          break;
        }
      }
    });

    return Array.from(imageUrls);
  }

  function buildArticleData(articleInfo) {
    const { element, metadata, strategy } = articleInfo;
    const structured = collectStructuredData();

    const title = metadata?.title?.trim() || structured.title || getHeadingTitle(element) || extractTitleFromMeta();
    const author = (metadata?.byline && metadata.byline.trim()) || structured.author || extractAuthorFromMeta(element);
    const publishDate = structured.publishDate || extractPublishDate(element);
    const bodyText = metadata?.textContent?.trim()
      ? metadata.textContent.trim().split(/\n+/).map((line) => line.trim()).filter(Boolean)
      : collectBodyText(element);
    const images = collectImages(element, structured.images);

    return {
      title: title || document.title,
      author: author || null,
      publishDate: publishDate || null,
      bodyText,
      images,
      strategy,
      sourceUrl: window.location.href
    };
  }

  function extractArticle() {
    try {
      const articleInfo = findMainArticle();
      const articleData = buildArticleData(articleInfo);
      chrome.runtime?.sendMessage({ type: 'articleExtracted', payload: articleData });
      console.info('Article data extracted:', articleData);
    } catch (error) {
      console.error('Failed to extract article data:', error);
    }
  }

  whenReady(extractArticle);
})();
