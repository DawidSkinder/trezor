(function () {
  const mapRoot = document.querySelector("[data-evidence-map]");

  if (!mapRoot) {
    return;
  }

  const DATA_PATHS = {
    evidenceMap: "data/001-evidence-map.csv",
  };
  const DATA_VERSION = "20260420-layout-clearance-2";
  const DUMMY_IMAGE_SOURCES = {
    small: "data/assets/dummy_image_small.png",
    big: "data/assets/dummy_image_big.png",
  };

  const CARD_WIDTHS = {
    "big-image": 664,
    "big-map": 664,
    timeline: 1008,
    badge: 320,
    text: 320,
    "text-image": 320,
    "text-image-ext": 320,
    image: 320,
    achievement: 320,
    metric: 320,
    quote: 320,
    map: 320,
    link: 320,
  };

  const ESTIMATED_CARD_HEIGHTS = {
    badge: 144,
    link: 100,
    metric: 260,
    map: 417,
    quote: 360,
    timeline: 360,
    "big-image": 560,
    "big-map": 560,
    image: 417,
    "text-image": 520,
    "text-image-ext": 680,
    achievement: 468,
    text: 300,
  };

  const VISIBLE_CARD_STATES = new Set(["show", "visible", "true", "yes", "1"]);
  const MASONRY_GAP = 32;
  const DS_CLUSTER_TITLE_GAP = 48;
  const COMPACT_MASONRY_CLUSTERS = new Set(["ds-complex-products", "ds-awards-recognition"]);
  const TREZOR_RING = {
    radius: 1320,
    centerYOffset: 72,
    startTheta: -Math.PI / 2,
    direction: 1,
  };
  const DS_CLUSTER_RING = {
    radius: 2800,
    safeRadius: 1780,
    safeMargin: 140,
  };

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let isQuoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === '"') {
        if (isQuoted && nextChar === '"') {
          value += '"';
          index += 1;
        } else {
          isQuoted = !isQuoted;
        }
      } else if (char === "," && !isQuoted) {
        row.push(value.trim());
        value = "";
      } else if ((char === "\n" || char === "\r") && !isQuoted) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }

        row.push(value.trim());
        value = "";

        if (row.some((cell) => cell.length > 0)) {
          rows.push(row);
        }

        row = [];
      } else {
        value += char;
      }
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value.trim());

      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
    }

    const [headers, ...dataRows] = rows;

    if (!headers) {
      return [];
    }

    return dataRows.map((dataRow) =>
      Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
    );
  }

  async function loadCsv(path) {
    const versionedPath = `${path}?v=${DATA_VERSION}`;
    const response = await fetch(versionedPath, { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 0 || window.location.protocol === "file:") {
        throw new Error(
          `Cannot load ${path} from a local file. Start the local static server and open http://127.0.0.1:8000/.`,
        );
      }

      throw new Error(`Failed to load ${path}: ${response.status}`);
    }

    return parseCsv(await response.text());
  }

  function parseBoolean(value) {
    return String(value).toLowerCase() === "true";
  }

  function isDebugMode() {
    return new URLSearchParams(window.location.search).has("debugRing");
  }

  function normalizeCardNo(value) {
    const normalizedValue = String(value ?? "")
      .trim()
      .replace(/^c/i, "");
    const parsedValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return "";
    }

    return String(parsedValue).padStart(3, "0");
  }

  function isVisibleCard(card) {
    return VISIBLE_CARD_STATES.has(String(card.visible ?? "").trim().toLowerCase());
  }

  function splitList(value) {
    return String(value ?? "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitConnectionList(value) {
    if (hasNoConnectionMarker(value)) {
      return [];
    }

    return String(value ?? "")
      .split(/[|,;]/)
      .map(normalizeCardNo)
      .filter(Boolean);
  }

  function titleFromClusterSlug(cluster) {
    return String(cluster ?? "")
      .replace(/^ds-/, "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getNumericValue(value, fallback) {
    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  function hasNoConnectionMarker(value) {
    return String(value ?? "").trim() === "-";
  }

  function getSectionAngle(sectionNo, sectionCount) {
    const sectionIndex = Math.max(Math.round(getNumericValue(sectionNo, 1)), 1);
    const safeSectionCount = Math.max(sectionCount, sectionIndex, 1);
    return ((sectionIndex - 1) / safeSectionCount) * 360 + 270;
  }

  function createLayoutFromCard(card, context) {
    const width = card.width || String(CARD_WIDTHS[card.type] ?? 320);
    const order = card.card_order || String(context.index + 1);

    if (card.association === "trezor") {
      const orderIndex = getNumericValue(order, context.index + 1) - 1;
      const cardCount = Math.max(context.trezorCount, 1);
      const theta = TREZOR_RING.startTheta + TREZOR_RING.direction * (orderIndex / cardCount) * Math.PI * 2;

      return {
        id: card.id,
        ring: "trezor",
        cluster_angle: "0",
        fallback_x: String(Math.round(Math.cos(theta) * 960)),
        fallback_y: String(Math.round(Math.sin(theta) * 780)),
        width,
        height: "auto",
        anchor: "top-left",
        order,
      };
    }

    const sectionAngle = getSectionAngle(card.section_no, context.sectionCount);
    const theta = degreesToRadians(sectionAngle);
    const orderOffset = getNumericValue(order, context.index + 1) * 48;

    return {
      id: card.id,
      ring: "ds",
      cluster_angle: String(sectionAngle),
      fallback_x: String(Math.round(Math.cos(theta) * 2200 + orderOffset)),
      fallback_y: String(Math.round(Math.sin(theta) * 2200 + orderOffset)),
      width,
      height: "auto",
      anchor: "top-left",
      order,
    };
  }

  function createConnectionRows(cards, cardByNumber) {
    const connections = [];
    const seenPairs = new Set();
    const cardsWithoutConnections = new Set(
      cards.filter((card) => hasNoConnectionMarker(card.connect_to)).map((card) => card.id),
    );

    for (const card of cards) {
      if (cardsWithoutConnections.has(card.id)) {
        continue;
      }

      for (const targetNumber of splitConnectionList(card.connect_to)) {
        const targetCard = cardByNumber.get(targetNumber);

        if (!targetCard || targetCard.id === card.id || cardsWithoutConnections.has(targetCard.id)) {
          continue;
        }

        const pair = [card.id, targetCard.id].sort().join("::");

        if (seenPairs.has(pair)) {
          continue;
        }

        seenPairs.add(pair);
        connections.push({
          id: `con-${card.card_no}-${targetCard.card_no}`,
          from_id: card.id,
          to_id: targetCard.id,
          relationship: "context",
          strength: "medium",
          priority: "primary",
          visible: "true",
        });
      }
    }

    return connections;
  }

  function createEvidenceModel(rows) {
    const cards = rows.map((row) => {
      const cardNo = normalizeCardNo(row.card_no);
      const slug = row.slug || `card-${cardNo}`;

      return {
        ...row,
        id: slug,
        card_no: cardNo,
        priority: isVisibleCard(row) ? "primary" : "cut",
        status: isVisibleCard(row) ? "final" : "cut",
      };
    });
    const visibleCards = cards.filter(isVisibleCard);
    const cardByNumber = new Map(visibleCards.map((card) => [card.card_no, card]));
    const sectionCount = Math.max(
      ...visibleCards
        .filter((card) => card.association === "ds")
        .map((card) => getNumericValue(card.section_no, 1)),
      1,
    );
    const trezorCount = visibleCards.filter((card) => card.association === "trezor").length;
    const layout = visibleCards.map((card, index) =>
      createLayoutFromCard(card, {
        index,
        sectionCount,
        trezorCount,
      }),
    );
    const connections = createConnectionRows(visibleCards, cardByNumber);

    window.__caseForFitCardIndex = visibleCards.map((card) => ({
      cardNo: card.card_no,
      id: card.id,
      title: card.title,
      cluster: card.cluster,
      clusterTitle: card.cluster_title,
      connectTo: splitConnectionList(card.connect_to),
      noConnections: hasNoConnectionMarker(card.connect_to),
    }));

    return {
      cards,
      connections,
      layout,
    };
  }

  function getCardWidth(card, layout) {
    const layoutWidth = Number.parseFloat(layout.width);

    if (Number.isFinite(layoutWidth)) {
      return layoutWidth;
    }

    return CARD_WIDTHS[card.type] ?? 320;
  }

  function getEstimatedCardHeight(card, layout) {
    const layoutHeight = Number.parseFloat(layout.height);

    if (Number.isFinite(layoutHeight)) {
      return layoutHeight;
    }

    return ESTIMATED_CARD_HEIGHTS[card.type] ?? 320;
  }

  function getCardPosition(card, layout) {
    const width = getCardWidth(card, layout);
    const height = getEstimatedCardHeight(card, layout);
    const x = Number.parseFloat(layout.fallback_x ?? layout.x);
    const y = Number.parseFloat(layout.fallback_y ?? layout.y);
    const anchor = layout.anchor || "center";

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    if (anchor === "top-left") {
      return { x, y, width, height };
    }

    if (anchor === "top") {
      return { x: x - width / 2, y, width, height };
    }

    if (anchor === "bottom") {
      return { x: x - width / 2, y: y - height, width, height };
    }

    if (anchor === "left") {
      return { x, y: y - height / 2, width, height };
    }

    if (anchor === "right") {
      return { x: x - width, y: y - height / 2, width, height };
    }

    return { x: x - width / 2, y: y - height / 2, width, height };
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function createImage(className, src, alt = "", fallbackSrc = "") {
    const image = document.createElement("img");
    image.className = className;
    image.src = src;
    image.alt = alt;

    if (fallbackSrc && fallbackSrc !== src) {
      image.addEventListener(
        "error",
        () => {
          image.src = fallbackSrc;
        },
        { once: true },
      );
    }

    return image;
  }

  function getDataAssetSrc(fileName) {
    const cleanFileName = String(fileName ?? "").trim();
    return cleanFileName ? `data/assets/${cleanFileName}` : "";
  }

  function getCardImageSrc(card, fallbackSrc) {
    return getDataAssetSrc(card.image_src) || fallbackSrc;
  }

  function createDivider() {
    return createElement("div", "card-divider");
  }

  function createCardConnector(card, hasConnections) {
    const connector = createElement("div", "card-connector");
    connector.setAttribute("aria-hidden", "true");

    const shape = createImage(
      `connector-shape ${hasConnections ? "connector-shape-connected" : "connector-shape-no"}`,
      hasConnections ? "assets/card-connection-union.svg" : "assets/card-connection-subtract.svg",
    );
    connector.append(shape);

    const affiliation = createElement(
      "span",
      `connector-affiliation connector-affiliation-${card.association === "trezor" ? "trezor" : "ds"}`,
    );
    affiliation.append(
      createImage(
        `connector-affiliation-mark connector-affiliation-mark-${card.association === "trezor" ? "trezor" : "ds"}`,
        card.association === "trezor" ? "assets/tresor_logo_card.svg" : "assets/ds_logo_card.svg",
      ),
    );
    connector.append(affiliation);

    if (hasConnections) {
      connector.append(createElement("span", "connector-node"));
    }

    return connector;
  }

  function appendBodyCopy(shell, body) {
    if (!body) {
      return;
    }

    const items = splitList(body);

    if (items.length > 1) {
      const list = createElement("ul", "card-list");

      for (const item of items) {
        list.append(createElement("li", "", item));
      }

      shell.append(list);
      return;
    }

    const copy = createElement("div", "card-body-copy");
    copy.append(createElement("p", "", body));
    shell.append(copy);
  }

  function appendCaptionAndDivider(shell, caption) {
    if (!caption) {
      return;
    }

    shell.append(createElement("p", "card-caption", caption));
    shell.append(createDivider());
  }

  function renderTextCard(shell, card) {
    shell.append(createElement("h2", "card-headline", card.title));
    appendBodyCopy(shell, card.body);
  }

  function renderTextImageCard(shell, card) {
    shell.append(createElement("h2", "card-headline", card.title));
    shell.append(
      createImage(
        "card-media card-media-square",
        getCardImageSrc(card, DUMMY_IMAGE_SOURCES.small),
        "",
        DUMMY_IMAGE_SOURCES.small,
      ),
    );
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderTextImageExtCard(shell, card) {
    shell.append(createElement("h2", "card-headline", card.title));
    shell.append(
      createImage(
        "card-media card-media-square",
        getCardImageSrc(card, DUMMY_IMAGE_SOURCES.small),
        "",
        DUMMY_IMAGE_SOURCES.small,
      ),
    );
    appendCaptionAndDivider(shell, card.caption);
    appendBodyCopy(shell, card.body);
  }

  function renderImageCard(shell, card) {
    shell.append(
      createImage(
        "card-media card-media-square",
        getCardImageSrc(card, DUMMY_IMAGE_SOURCES.small),
        "",
        DUMMY_IMAGE_SOURCES.small,
      ),
    );
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderBigImageCard(shell, card) {
    shell.append(
      createImage(
        "card-media card-media-big",
        getCardImageSrc(card, DUMMY_IMAGE_SOURCES.big),
        "",
        DUMMY_IMAGE_SOURCES.big,
      ),
    );
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderAchievementCard(shell, card) {
    shell.append(createElement("h2", "card-headline", card.title));
    shell.append(createImage("achievement-mark", getDataAssetSrc(card.image_src) || "assets/card-behance-achievement.svg", ""));
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderMetricCard(shell, card) {
    shell.append(createElement("h2", "card-metric", card.metric_value || card.title));
    shell.append(createElement("p", "card-headline", card.metric_label || card.body || card.title));
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderQuoteCard(shell, card) {
    shell.append(createImage("quote-mark", "assets/card-quote-mark.svg", ""));
    shell.append(createElement("blockquote", "card-headline", card.quote || card.body || card.title));
    appendCaptionAndDivider(shell, card.caption);
  }

  function createMapFrame(card, className = "map-frame") {
    const mapFrame = createElement("div", className);
    mapFrame.dataset.mapCard = "";
    mapFrame.dataset.mapLat = card.map_lat;
    mapFrame.dataset.mapLng = card.map_lng;
    mapFrame.dataset.mapTitle = card.title;
    mapFrame.dataset.mapZoom = "15";
    mapFrame.setAttribute("role", "img");
    mapFrame.setAttribute("aria-label", `Map focused on ${card.map_address || card.title}`);

    const fallback = createElement("div", "map-card-fallback");
    fallback.append(createElement("strong", "", card.title));
    fallback.append(createElement("span", "", card.map_address || card.caption));
    mapFrame.append(fallback);

    return mapFrame;
  }

  function renderMapCard(shell, card) {
    shell.append(createMapFrame(card));
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderBigMapCard(shell, card) {
    const mapFrame = createMapFrame(card, "map-frame map-frame-big");
    shell.append(mapFrame);
    appendCaptionAndDivider(shell, card.caption);
  }

  function renderTimelineCard(shell, card) {
    shell.classList.add("timeline-shell");

    const columns = [
      ["30d", card.timeline_30],
      ["60d", card.timeline_60],
      ["90d", card.timeline_90],
    ];

    for (const [label, value] of columns) {
      const column = createElement("section", "timeline-column");
      column.append(createElement("h2", "card-metric", label));
      column.append(createDivider());

      const list = createElement("ul", "card-list");

      for (const item of splitList(value)) {
        list.append(createElement("li", "", item));
      }

      column.append(list);
      shell.append(column);
    }
  }

  function renderLinkCard(shell, card) {
    shell.classList.add("card-link-shell");

    const link = createElement("a", "card-link-button");
    link.href = card.link_url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.append(createElement("span", "", card.link_label || card.title));
    link.append(createImage("card-link-arrow", "assets/card-link-arrow.svg", ""));
    shell.append(link);
  }

  function renderBadgeCard(shell, card) {
    shell.append(createElement("h2", "card-headline", card.title));
  }

  function renderCardContent(shell, card) {
    if (card.type === "text-image") {
      renderTextImageCard(shell, card);
    } else if (card.type === "text-image-ext") {
      renderTextImageExtCard(shell, card);
    } else if (card.type === "image") {
      renderImageCard(shell, card);
    } else if (card.type === "big-image") {
      renderBigImageCard(shell, card);
    } else if (card.type === "achievement") {
      renderAchievementCard(shell, card);
    } else if (card.type === "metric") {
      renderMetricCard(shell, card);
    } else if (card.type === "quote") {
      renderQuoteCard(shell, card);
    } else if (card.type === "map") {
      renderMapCard(shell, card);
    } else if (card.type === "big-map") {
      renderBigMapCard(shell, card);
    } else if (card.type === "timeline") {
      renderTimelineCard(shell, card);
    } else if (card.type === "link") {
      renderLinkCard(shell, card);
    } else if (card.type === "badge") {
      renderBadgeCard(shell, card);
    } else {
      renderTextCard(shell, card);
    }
  }

  function createCard(card, layout, position, hasConnections) {
    const article = createElement("article", `evidence-card card-${card.type}`);
    article.dataset.cardId = card.id;
    article.dataset.cardType = card.type;
    article.dataset.affiliation = card.association;
    article.dataset.connectionState = hasConnections ? "default" : "no";
    article.dataset.cardNo = card.card_no || "";

    if (hasConnections) {
      article.dataset.cardNode = card.id;
    }

    article.style.left = `${position.x}px`;
    article.style.top = `${position.y}px`;
    if (card.type === "badge") {
      article.style.width = "max-content";
      article.style.maxWidth = `${position.width}px`;
    } else {
      article.style.width = `${position.width}px`;
    }
    article.style.setProperty("--card-x", `${position.x}px`);
    article.style.setProperty("--card-y", `${position.y}px`);
    article.style.setProperty("--cluster-angle", layout.cluster_angle || "0");

    if (isDebugMode() && card.card_no) {
      article.append(createElement("div", "debug-card-number", card.card_no));
    }

    article.append(createCardConnector(card, hasConnections));

    const shell = createElement("div", "card-shell");
    renderCardContent(shell, card);
    article.append(shell);

    return article;
  }

  function createCenterThesis() {
    const thesis = createElement("section", "landing-copy evidence-map-thesis");
    thesis.setAttribute("aria-labelledby", "landing-title");
    thesis.innerHTML = `
      <h1 class="landing-title" id="landing-title">The Case for Fit</h1>
      <p class="landing-subtitle">AI Native Product Designer<br />Trezor × Dawid Skinder</p>
      <p class="landing-meta">
        <span>Built as an AI-native prototype</span>
        <img
          class="landing-meta-icon"
          src="assets/conversation-separator.svg"
          alt=""
          width="15"
          height="20"
          aria-hidden="true"
        />
        <span>before our conversation.</span>
      </p>
    `;
    return thesis;
  }

  function getRenderedConnections(connections, cardIds) {
    return connections.filter(
      (connection) =>
        parseBoolean(connection.visible) &&
        connection.priority !== "cut" &&
        cardIds.has(connection.from_id) &&
        cardIds.has(connection.to_id),
    );
  }

  function getConnectionDegree(connections) {
    const degree = new Map();

    for (const connection of connections) {
      degree.set(connection.from_id, (degree.get(connection.from_id) ?? 0) + 1);
      degree.set(connection.to_id, (degree.get(connection.to_id) ?? 0) + 1);
    }

    return degree;
  }

  function getDotCenter(cardElement) {
    const connector = cardElement.querySelector(".card-connector");
    const node = cardElement.querySelector(".connector-node");

    if (!connector || !node) {
      return null;
    }

    return {
      x: cardElement.offsetLeft + connector.offsetLeft + node.offsetLeft + node.offsetWidth / 2,
      y: cardElement.offsetTop + connector.offsetTop + node.offsetTop + node.offsetHeight / 2,
    };
  }

  function drawConnections(svg, root, connections) {
    const renderedCards = new Map(
      Array.from(root.querySelectorAll("[data-card-id]")).map((card) => [card.dataset.cardId, card]),
    );

    svg.replaceChildren();

    for (const connection of connections) {
      const fromCard = renderedCards.get(connection.from_id);
      const toCard = renderedCards.get(connection.to_id);
      const from = fromCard ? getDotCenter(fromCard) : null;
      const to = toCard ? getDotCenter(toCard) : null;

      if (!from || !to) {
        continue;
      }

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.classList.add("connection-line");
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      line.dataset.connectionLine = "";
      line.dataset.connectionFrom = connection.from_id;
      line.dataset.connectionTo = connection.to_id;
      line.dataset.relationship = connection.relationship;
      line.dataset.strength = connection.strength;
      svg.append(line);
    }
  }

  function getHeadlineCenter(root) {
    const thesis = root.querySelector(".evidence-map-thesis");
    const headline = root.querySelector("#landing-title");

    if (!thesis || !headline) {
      return null;
    }

    return {
      x: thesis.offsetLeft - thesis.offsetWidth / 2 + headline.offsetLeft + headline.offsetWidth / 2,
      y:
        thesis.offsetTop -
        thesis.offsetHeight / 2 +
        headline.offsetTop +
        headline.offsetHeight / 2 +
        TREZOR_RING.centerYOffset,
    };
  }

  function positionTrezorRingCards(root, normalizedCards) {
    const trezorCards = normalizedCards
      .filter(({ card, layout }) => card.association === "trezor" && layout.ring === "trezor")
      .sort(
        (first, second) =>
          (Number.parseFloat(first.layout.order) || 0) - (Number.parseFloat(second.layout.order) || 0),
      );

    if (!trezorCards.length) {
      return;
    }

    const ringCenter = getHeadlineCenter(root);

    if (!ringCenter) {
      return;
    }

    const spacingOffset = 0;
    const angleStep = (Math.PI * 2) / trezorCards.length;
    const diagnostics = {
      mode: "circle",
      center: ringCenter,
      radius: TREZOR_RING.radius,
      cardCount: trezorCards.length,
      angleStepDegrees: 360 / trezorCards.length,
      cards: [],
    };

    trezorCards.forEach(({ card }, index) => {
      const element = root.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`);

      if (!element) {
        return;
      }

      const shell = element.querySelector(".card-shell");
      const centerOffsetX = shell ? shell.offsetLeft + shell.offsetWidth / 2 : element.offsetWidth / 2;
      const centerOffsetY = shell ? shell.offsetTop + shell.offsetHeight / 2 : element.offsetHeight / 2;
      const theta = TREZOR_RING.startTheta + TREZOR_RING.direction * (index + spacingOffset) * angleStep;
      const unitX = Math.cos(theta);
      const unitY = Math.sin(theta);
      const shellWidth = shell?.offsetWidth || element.offsetWidth;
      const shellHeight = shell?.offsetHeight || element.offsetHeight;
      const shellHalfWidth = shellWidth / 2;
      const shellHalfHeight = shellHeight / 2;
      const tangentSupport = shellHalfWidth * Math.abs(unitX) + shellHalfHeight * Math.abs(unitY);
      const tangentX = ringCenter.x + TREZOR_RING.radius * unitX;
      const tangentY = ringCenter.y + TREZOR_RING.radius * unitY;
      const centerX = ringCenter.x + (TREZOR_RING.radius + tangentSupport) * unitX;
      const centerY = ringCenter.y + (TREZOR_RING.radius + tangentSupport) * unitY;
      const x = centerX - centerOffsetX;
      const y = centerY - centerOffsetY;
      const tangentDistance = Math.hypot(tangentX - ringCenter.x, tangentY - ringCenter.y);

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.setProperty("--card-x", `${x}px`);
      element.style.setProperty("--card-y", `${y}px`);
      element.dataset.ringLayout = "circle";

      diagnostics.cards.push({
        id: card.id,
        centerX,
        centerY,
        tangentX,
        tangentY,
        theta,
        tangentSupport,
        tangentDistance,
        tangentError: Math.abs(tangentDistance - TREZOR_RING.radius),
      });
    });

    diagnostics.maxTangentError = Math.max(...diagnostics.cards.map((card) => card.tangentError));
    window.__caseForFitTrezorRing = diagnostics;

    if (isDebugMode()) {
      root.querySelector(".trezor-ring-debug")?.remove();
      const debugRing = createElement("div", "trezor-ring-debug");
      debugRing.style.left = `${ringCenter.x}px`;
      debugRing.style.top = `${ringCenter.y}px`;
      debugRing.style.width = `${TREZOR_RING.radius * 2}px`;
      debugRing.style.height = `${TREZOR_RING.radius * 2}px`;
      root.append(debugRing);
    }
  }

  function normalizeAngle(radians) {
    const fullTurn = Math.PI * 2;
    return ((radians % fullTurn) + fullTurn) % fullTurn;
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function radiansToDegrees(radians) {
    return (normalizeAngle(radians) * 180) / Math.PI;
  }

  function getCircularMean(radians) {
    const x = radians.reduce((total, value) => total + Math.cos(value), 0);
    const y = radians.reduce((total, value) => total + Math.sin(value), 0);

    if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) {
      return 0;
    }

    return normalizeAngle(Math.atan2(y, x));
  }

  function renderDsRingDebugGuides(root, ringCenter) {
    if (!isDebugMode()) {
      return;
    }

    root.querySelector(".safe-zone-debug")?.remove();
    root.querySelector(".ds-ring-debug")?.remove();

    const safeZone = createElement("div", "safe-zone-debug");
    safeZone.style.left = `${ringCenter.x}px`;
    safeZone.style.top = `${ringCenter.y}px`;
    safeZone.style.width = `${DS_CLUSTER_RING.safeRadius * 2}px`;
    safeZone.style.height = `${DS_CLUSTER_RING.safeRadius * 2}px`;
    root.append(safeZone);

    const dsRing = createElement("div", "ds-ring-debug");
    dsRing.style.left = `${ringCenter.x}px`;
    dsRing.style.top = `${ringCenter.y}px`;
    dsRing.style.width = `${DS_CLUSTER_RING.radius * 2}px`;
    dsRing.style.height = `${DS_CLUSTER_RING.radius * 2}px`;
    root.append(dsRing);
  }

  function getMasonryColumnCount(items) {
    const cardCount = items.length;

    if (cardCount <= 1) {
      return Math.max(1, cardCount);
    }

    let best = { columns: 1, rows: cardCount, balance: cardCount - 1 };

    for (let columns = 1; columns <= cardCount; columns += 1) {
      const rows = Math.ceil(cardCount / columns);

      if (rows < columns) {
        continue;
      }

      const balance = rows - columns;

      if (balance < best.balance || (balance === best.balance && columns > best.columns)) {
        best = { columns, rows, balance };
      }
    }

    return best.columns;
  }

  function getDenseMasonryColumnCount(items) {
    const baseColumnCount = getMasonryColumnCount(items);
    return Math.min(Math.max(baseColumnCount, 2), 3);
  }

  function getMasonrySpan(width, columnWidth, columnCount) {
    const normalizedWidth = Number.isFinite(width) ? width : columnWidth;
    const span = Math.round((normalizedWidth + MASONRY_GAP) / (columnWidth + MASONRY_GAP));
    return Math.min(Math.max(span, 1), columnCount);
  }

  function measureMasonryItems(root, sortedItems, columnCount = getMasonryColumnCount(sortedItems)) {
    const rowCount = Math.ceil(sortedItems.length / columnCount);

    return {
      rowCount,
      items: sortedItems
        .map(({ card, position }, index) => {
          const element = root.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`);

          if (!element) {
            return null;
          }

          return {
            card,
            element,
            index,
            column: index % columnCount,
            row: Math.floor(index / columnCount),
            width: element.offsetWidth || position.width,
            height: element.offsetHeight || position.height,
          };
        })
        .filter(Boolean),
    };
  }

  function positionCardElement(element, x, y) {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.setProperty("--card-x", `${x}px`);
    element.style.setProperty("--card-y", `${y}px`);
  }

  function getDsClusterName(item) {
    return item.card.cluster || item.card.id;
  }

  function sortMasonryItems(items) {
    return [...items].sort((first, second) => {
      const firstOrder = Number.parseFloat(first.layout.order) || 0;
      const secondOrder = Number.parseFloat(second.layout.order) || 0;

      if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder;
      }

      if (first.position.y !== second.position.y) {
        return first.position.y - second.position.y;
      }

      return first.position.x - second.position.x;
    });
  }

  function getDsClusterAngle(items) {
    const angles = items
      .map(({ layout }) => Number.parseFloat(layout.cluster_angle))
      .filter(Number.isFinite)
      .map(degreesToRadians);

    return angles.length ? getCircularMean(angles) : 0;
  }

  function getEvenClusterSlots(records) {
    if (records.length <= 1) {
      return records.map((record) => ({ record, theta: record.sourceTheta, slotIndex: 0 }));
    }

    const sortedRecords = [...records].sort((first, second) => first.sourceTheta - second.sourceTheta);
    const angleStep = (Math.PI * 2) / sortedRecords.length;
    const slotOffsets = sortedRecords.map((record, index) => normalizeAngle(record.sourceTheta - index * angleStep));
    const offset = getCircularMean(slotOffsets);

    return sortedRecords.map((record, index) => ({
      record,
      theta: normalizeAngle(offset + index * angleStep),
      slotIndex: index,
    }));
  }

  function buildDenseMasonryLayout(root, sortedItems) {
    const columnCount = getDenseMasonryColumnCount(sortedItems);
    const columnWidth = CARD_WIDTHS.text;
    const { items: measuredItems } = measureMasonryItems(root, sortedItems, columnCount);
    const columnHeights = Array.from({ length: columnCount }, () => 0);
    const cards = [];

    for (const item of measuredItems) {
      const span = getMasonrySpan(item.width, columnWidth, columnCount);
      let bestColumn = 0;
      let bestY = Number.POSITIVE_INFINITY;

      for (let column = 0; column <= columnCount - span; column += 1) {
        const y = Math.max(...columnHeights.slice(column, column + span));

        if (y < bestY) {
          bestColumn = column;
          bestY = y;
        }
      }

      const localX = bestColumn * (columnWidth + MASONRY_GAP);
      const localY = bestY;
      const nextHeight = localY + item.height + MASONRY_GAP;

      for (let column = bestColumn; column < bestColumn + span; column += 1) {
        columnHeights[column] = nextHeight;
      }

      cards.push({
        ...item,
        column: bestColumn,
        span,
        localX,
        localY,
      });
    }

    const blockWidth = Math.max(
      columnCount * columnWidth + (columnCount - 1) * MASONRY_GAP,
      ...cards.map((item) => item.localX + item.width),
      0,
    );
    const blockHeight = Math.max(...columnHeights.map((height) => Math.max(height - MASONRY_GAP, 0)), 0);

    return {
      mode: "dense",
      columnCount,
      rowCount: null,
      columnWidth,
      rowHeights: columnHeights.map((height) => Math.max(height - MASONRY_GAP, 0)),
      cards,
      blockWidth,
      blockHeight,
    };
  }

  function buildMasonryLayout(root, sortedItems, cluster) {
    if (COMPACT_MASONRY_CLUSTERS.has(cluster)) {
      return buildDenseMasonryLayout(root, sortedItems);
    }

    const columnCount = getMasonryColumnCount(sortedItems);
    const columnWidth = Math.max(...sortedItems.map(({ position }) => position.width));
    const { rowCount, items: measuredItems } = measureMasonryItems(root, sortedItems, columnCount);
    const rowHeights = Array.from({ length: rowCount }, (_, row) =>
      Math.max(
        ...measuredItems
          .filter((item) => item.row === row)
          .map((item) => item.height),
        0,
      ),
    );
    const rowYs = rowHeights.map((_, row) =>
      rowHeights.slice(0, row).reduce((total, height) => total + height + MASONRY_GAP, 0),
    );
    const cards = measuredItems.map((item) => ({
      ...item,
      localX: item.column * (columnWidth + MASONRY_GAP),
      localY: rowYs[item.row],
    }));
    const blockWidth = Math.max(...cards.map((item) => item.localX + item.width), 0);
    const blockHeight = Math.max(...cards.map((item) => item.localY + item.height), 0);

    return {
      mode: "row-grid",
      columnCount,
      rowCount,
      columnWidth,
      rowHeights,
      cards,
      blockWidth,
      blockHeight,
    };
  }

  function getDsClusterTitle(items, cluster) {
    return (
      items
        .map((item) => item.card.cluster_title)
        .find((title) => String(title ?? "").trim().length > 0) || titleFromClusterSlug(cluster)
    );
  }

  function createDsClusterTitle(title) {
    return createElement("h2", "ds-cluster-title", title);
  }

  function positionDsMasonryClusters(root, normalizedCards) {
    const clusters = new Map();

    normalizedCards.forEach((item) => {
      if (item.card.association !== "ds") {
        return;
      }

      const cluster = getDsClusterName(item);

      if (!clusters.has(cluster)) {
        clusters.set(cluster, []);
      }

      clusters.get(cluster).push(item);
    });

    const ringCenter = getHeadlineCenter(root);

    if (!ringCenter) {
      return;
    }

    renderDsRingDebugGuides(root, ringCenter);

    const clusterRecords = Array.from(clusters, ([cluster, items]) => {
      const sortedItems = sortMasonryItems(items);
      const layout = buildMasonryLayout(root, sortedItems, cluster);
      const titleElement = createDsClusterTitle(getDsClusterTitle(sortedItems, cluster));
      root.append(titleElement);

      return {
        cluster,
        items: sortedItems,
        title: titleElement.textContent,
        titleElement,
        sourceTheta: getDsClusterAngle(sortedItems),
        layout,
      };
    });
    const slots = getEvenClusterSlots(clusterRecords);
    const masonryDiagnostics = {};
    const ringDiagnostics = {
      mode: "outer-cluster-ring",
      center: ringCenter,
      radius: DS_CLUSTER_RING.radius,
      safeRadius: DS_CLUSTER_RING.safeRadius,
      safeMargin: DS_CLUSTER_RING.safeMargin,
      clusterCount: clusterRecords.length,
      angleStepDegrees: clusterRecords.length ? 360 / clusterRecords.length : 0,
      clusters: [],
    };

    slots.forEach(({ record, theta, slotIndex }) => {
      const unitX = Math.cos(theta);
      const unitY = Math.sin(theta);
      const { layout } = record;
      const titleWidth = record.titleElement.offsetWidth;
      const titleHeight = record.titleElement.offsetHeight;
      const totalBlockWidth = Math.max(layout.blockWidth, titleWidth);
      const totalBlockHeight = titleHeight + DS_CLUSTER_TITLE_GAP + layout.blockHeight;
      const blockHalfWidth = totalBlockWidth / 2;
      const blockHalfHeight = totalBlockHeight / 2;
      const radialSupport = blockHalfWidth * Math.abs(unitX) + blockHalfHeight * Math.abs(unitY);
      const minimumCenterRadius = DS_CLUSTER_RING.safeRadius + DS_CLUSTER_RING.safeMargin + radialSupport;
      const centerRadius = Math.max(DS_CLUSTER_RING.radius, minimumCenterRadius);
      const clusterCenterX = ringCenter.x + centerRadius * unitX;
      const clusterCenterY = ringCenter.y + centerRadius * unitY;
      const originX = clusterCenterX - blockHalfWidth;
      const originY = clusterCenterY - blockHalfHeight;
      const titleX = originX;
      const titleY = originY;
      const cardOriginX = originX;
      const cardOriginY = originY + titleHeight + DS_CLUSTER_TITLE_GAP;
      const cards = [];

      record.titleElement.style.left = `${titleX}px`;
      record.titleElement.style.top = `${titleY}px`;
      record.titleElement.dataset.masonryClusterTitle = record.cluster;

      layout.cards.forEach((item) => {
        const x = cardOriginX + item.localX;
        const y = cardOriginY + item.localY;

        positionCardElement(item.element, x, y);
        item.element.dataset.masonryCluster = record.cluster;
        item.element.dataset.clusterRing = "outer";

        cards.push({
          id: item.card.id,
          x,
          y,
          width: item.width,
          height: item.height,
          column: item.column,
          row: item.row,
          span: item.span || 1,
        });
      });

      masonryDiagnostics[record.cluster] = {
        mode: layout.mode,
        title: {
          text: record.title,
          x: titleX,
          y: titleY,
          width: titleWidth,
          height: titleHeight,
        },
        columnCount: layout.columnCount,
        rowCount: layout.rowCount,
        gap: MASONRY_GAP,
        titleGap: DS_CLUSTER_TITLE_GAP,
        origin: { x: cardOriginX, y: cardOriginY },
        rowHeights: layout.rowHeights,
        block: {
          width: layout.blockWidth,
          height: layout.blockHeight,
        },
        cards,
      };

      ringDiagnostics.clusters.push({
        cluster: record.cluster,
        title: record.title,
        slotIndex,
        sourceAngleDegrees: radiansToDegrees(record.sourceTheta),
        slotAngleDegrees: radiansToDegrees(theta),
        center: { x: clusterCenterX, y: clusterCenterY },
        titlePosition: { x: titleX, y: titleY },
        centerRadius,
        radialSupport,
        safeClearance: centerRadius - radialSupport - DS_CLUSTER_RING.safeRadius,
        pushedOutward: centerRadius > DS_CLUSTER_RING.radius,
        block: {
          width: totalBlockWidth,
          height: totalBlockHeight,
          cardWidth: layout.blockWidth,
          cardHeight: layout.blockHeight,
          titleWidth,
          titleHeight,
          titleGap: DS_CLUSTER_TITLE_GAP,
        },
      });
    });

    window.__caseForFitDsMasonry = masonryDiagnostics;
    window.__caseForFitDsClusterRing = ringDiagnostics;
  }

  function getAbsoluteElementBounds(element) {
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const left = element.offsetLeft;
    const top = element.offsetTop;
    const isCenterAnchored =
      element.classList.contains("landing-copy") ||
      element.classList.contains("trezor-ring-debug") ||
      element.classList.contains("safe-zone-debug") ||
      element.classList.contains("ds-ring-debug");

    if (isCenterAnchored) {
      return {
        minX: left - width / 2,
        minY: top - height / 2,
        maxX: left + width / 2,
        maxY: top + height / 2,
      };
    }

    return {
      minX: left,
      minY: top,
      maxX: left + width,
      maxY: top + height,
    };
  }

  function shiftAbsoluteElement(element, shiftX, shiftY) {
    const parsedLeft = Number.parseFloat(element.style.left);
    const parsedTop = Number.parseFloat(element.style.top);
    const left = Number.isFinite(parsedLeft) ? parsedLeft : element.offsetLeft;
    const top = Number.isFinite(parsedTop) ? parsedTop : element.offsetTop;
    element.style.left = `${left + shiftX}px`;
    element.style.top = `${top + shiftY}px`;
  }

  function shiftPoint(point, shiftX, shiftY) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }

    point.x += shiftX;
    point.y += shiftY;
  }

  function shiftLayoutDiagnostics(shiftX, shiftY) {
    const trezorRing = window.__caseForFitTrezorRing;

    if (trezorRing) {
      shiftPoint(trezorRing.center, shiftX, shiftY);

      for (const card of trezorRing.cards || []) {
        for (const key of ["centerX", "tangentX"]) {
          if (Number.isFinite(card[key])) {
            card[key] += shiftX;
          }
        }

        for (const key of ["centerY", "tangentY"]) {
          if (Number.isFinite(card[key])) {
            card[key] += shiftY;
          }
        }
      }
    }

    const dsRing = window.__caseForFitDsClusterRing;

    if (dsRing) {
      shiftPoint(dsRing.center, shiftX, shiftY);

      for (const cluster of dsRing.clusters || []) {
        shiftPoint(cluster.center, shiftX, shiftY);
        shiftPoint(cluster.titlePosition, shiftX, shiftY);
      }
    }

    const masonry = window.__caseForFitDsMasonry;

    if (masonry) {
      for (const cluster of Object.values(masonry)) {
        shiftPoint(cluster.origin, shiftX, shiftY);
        shiftPoint(cluster.title, shiftX, shiftY);

        for (const card of cluster.cards || []) {
          if (Number.isFinite(card.x)) {
            card.x += shiftX;
          }

          if (Number.isFinite(card.y)) {
            card.y += shiftY;
          }
        }
      }
    }
  }

  function updateBounds(root) {
    const contentElements = Array.from(
      root.querySelectorAll(
        "[data-card-id], .ds-cluster-title, .evidence-map-thesis, .trezor-ring-debug, .safe-zone-debug, .ds-ring-debug",
      ),
    ).filter((element) => element.offsetWidth > 0 && element.offsetHeight > 0);

    if (!contentElements.length) {
      return;
    }

    const bounds = contentElements.map(getAbsoluteElementBounds);
    const minX = Math.min(...bounds.map((bound) => bound.minX));
    const minY = Math.min(...bounds.map((bound) => bound.minY));
    const maxX = Math.max(...bounds.map((bound) => bound.maxX));
    const maxY = Math.max(...bounds.map((bound) => bound.maxY));
    const padding = 220;
    const halfPadding = padding / 2;
    const shiftX = halfPadding - minX;
    const shiftY = halfPadding - minY;

    for (const element of contentElements) {
      shiftAbsoluteElement(element, shiftX, shiftY);
    }

    shiftLayoutDiagnostics(shiftX, shiftY);

    root.style.left = "0px";
    root.style.top = "0px";
    root.style.width = `${maxX - minX + padding}px`;
    root.style.height = `${maxY - minY + padding}px`;

    window.__caseForFitCanvasBounds = {
      x: 0,
      y: 0,
      width: maxX - minX + padding,
      height: maxY - minY + padding,
    };

    window.__caseForFitCanvasFitPadding = {
      top: 96,
      right: 144,
      bottom: 96,
      left: 144,
    };
  }

  function nextFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  }

  function waitForImage(image, timeoutMs = 1200) {
    if (image.complete) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let timeoutId = 0;

      const finish = () => {
        window.clearTimeout(timeoutId);
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };

      image.addEventListener("load", finish);
      image.addEventListener("error", finish);
      timeoutId = window.setTimeout(finish, timeoutMs);
    });
  }

  async function waitForCanvasAssets(root) {
    const images = Array.from(root.querySelectorAll(".evidence-card img"));

    await Promise.all(images.map(waitForImage));
    await nextFrame();
  }

  function setCanvasReady() {
    const stage = mapRoot.closest(".stage");

    stage?.classList.remove("is-canvas-loading");
    stage?.classList.add("is-canvas-ready");
    document.dispatchEvent(new CustomEvent("caseforfit:canvas-ready"));
  }

  function fitCanvasToReadyBounds(maxAttempts = 6) {
    return new Promise((resolve) => {
      let attempt = 0;

      const tryFit = () => {
        attempt += 1;
        const didFit = window.__canvasCopy?.fitToScreen?.({ animate: false, requireBounds: true });

        if (didFit || attempt >= maxAttempts) {
          resolve(Boolean(didFit));
          return;
        }

        window.requestAnimationFrame(tryFit);
      };

      tryFit();
    });
  }

  function renderError(error) {
    mapRoot.closest(".stage")?.classList.remove("is-canvas-loading");
    mapRoot.replaceChildren();
    const errorBox = createElement("section", "canvas-data-error");
    errorBox.innerHTML = `
      <h1>Canvas data could not load</h1>
      <p>${error.message}</p>
    `;
    mapRoot.append(errorBox);
  }

  async function renderCanvas() {
    const { cards, connections, layout: layoutRows } = createEvidenceModel(await loadCsv(DATA_PATHS.evidenceMap));

    const layoutById = new Map(layoutRows.map((layout) => [layout.id, layout]));
    const renderableCards = cards.filter(
      (card) =>
        isVisibleCard(card) &&
        layoutById.has(card.id),
    );
    const cardIds = new Set(renderableCards.map((card) => card.id));
    const renderedConnections = getRenderedConnections(connections, cardIds);
    const degree = getConnectionDegree(renderedConnections);
    const positionedCards = renderableCards
      .map((card) => {
        const layout = layoutById.get(card.id);
        const position = getCardPosition(card, layout);
        return position ? { card, layout, position } : null;
      })
      .filter(Boolean);

    if (!positionedCards.length) {
      throw new Error("No renderable cards found in data.");
    }

    const minX = Math.min(...positionedCards.map(({ position }) => position.x));
    const minY = Math.min(...positionedCards.map(({ position }) => position.y));
    const normalizedCards = positionedCards.map(({ card, layout, position }) => ({
      card,
      layout,
      position: {
        ...position,
        x: position.x - minX,
        y: position.y - minY,
      },
    }));

    mapRoot.replaceChildren();
    mapRoot.style.left = `${minX}px`;
    mapRoot.style.top = `${minY}px`;

    const connectionLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connectionLayer.classList.add("connection-layer");
    connectionLayer.setAttribute("aria-hidden", "true");
    mapRoot.append(connectionLayer);

    const thesis = createCenterThesis();
    thesis.style.left = `${-minX}px`;
    thesis.style.top = `${-minY}px`;
    mapRoot.append(thesis);

    for (const { card, layout, position } of normalizedCards) {
      mapRoot.append(createCard(card, layout, position, degree.has(card.id)));
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await waitForCanvasAssets(mapRoot);

    positionDsMasonryClusters(mapRoot, normalizedCards);
    positionTrezorRingCards(mapRoot, normalizedCards);
    updateBounds(mapRoot);

    await nextFrame();

    connectionLayer.setAttribute("viewBox", `0 0 ${mapRoot.offsetWidth} ${mapRoot.offsetHeight}`);
    drawConnections(connectionLayer, mapRoot, renderedConnections);
    document.dispatchEvent(new CustomEvent("caseforfit:canvas-rendered"));
    await fitCanvasToReadyBounds();
    setCanvasReady();
  }

  renderCanvas().catch((error) => {
    console.error(error);
    renderError(error);
  });
})();
