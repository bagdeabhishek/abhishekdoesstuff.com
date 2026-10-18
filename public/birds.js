(() => {
  "use strict";

  const elements = {
    wall: document.getElementById("bird-wall"),
    state: document.getElementById("bird-state"),
    speciesCount: document.getElementById("species-count"),
    detectionCount: document.getElementById("detection-count"),
    lastHeard: document.getElementById("last-heard"),
    filteredCount: document.getElementById("filtered-count"),
    latestDetection: document.getElementById("latest-detection"),
    streamLabel: document.getElementById("stream-label"),
    streamIndicator: document.querySelector(".stream-indicator"),
    coreBird: document.getElementById("core-bird"),
    coreTime: document.getElementById("core-time"),
    detectionRay: document.getElementById("detection-ray"),
    recentHearings: document.getElementById("recent-hearings"),
    dialog: document.getElementById("bird-dialog"),
    dialogClose: document.querySelector(".dialog-close"),
    dialogImage: document.getElementById("dialog-image"),
    dialogName: document.getElementById("dialog-name"),
    dialogScientific: document.getElementById("dialog-scientific"),
    dialogCount: document.getElementById("dialog-count"),
    dialogFirst: document.getElementById("dialog-first"),
    dialogLast: document.getElementById("dialog-last"),
    dialogConfidence: document.getElementById("dialog-confidence"),
    dialogArt: document.getElementById("dialog-art"),
    dialogCollection: document.getElementById("dialog-collection"),
    dialogNote: document.getElementById("dialog-note"),
    dialogSource: document.getElementById("dialog-source"),
  };

  const orbitConfig = {
    rare: { radius: 42, phase: -90, label: "outer orbit" },
    occasional: { radius: 28, phase: -75, label: "middle orbit" },
    familiar: { radius: 15.5, phase: -90, label: "daily chorus" },
  };

  let species = [];
  let recentDetections = [];
  let refreshTimer = null;
  let eventSource = null;
  let rayTimer = null;

  const numberFormat = new Intl.NumberFormat("en-IN");
  const dateFormat = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function formatDate(value) {
    if (!value) return "unknown";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? dateFormat.format(date) : "unknown";
  }

  function relativeTime(value) {
    if (!value) return "—";
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "—";
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function setStreamState(label, state) {
    elements.streamLabel.textContent = label;
    elements.streamIndicator.classList.toggle("is-waiting", state === "waiting");
    elements.streamIndicator.classList.toggle("is-offline", state === "offline");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rarityFor(count, maxCount) {
    if (maxCount <= 2) return 1;
    return clamp(1 - Math.log(Math.max(2, count) / 2) / Math.log(maxCount / 2), 0, 1);
  }

  function orbitFor(count) {
    if (count <= 5) return "rare";
    if (count <= 50) return "occasional";
    return "familiar";
  }

  function hashName(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function layoutBirds(birds) {
    const maxCount = Math.max(2, ...birds.map((bird) => bird.count));
    const groups = { rare: [], occasional: [], familiar: [] };

    for (const bird of birds) groups[orbitFor(bird.count)].push(bird);
    for (const group of Object.values(groups)) {
      group.sort((a, b) => hashName(a.scientific_name) - hashName(b.scientific_name));
    }

    const layouts = [];
    for (const orbit of ["rare", "occasional", "familiar"]) {
      const group = groups[orbit];
      const config = orbitConfig[orbit];
      group.forEach((bird, index) => {
        const rarity = rarityFor(bird.count, maxCount);
        const baseSize = 5 + 9 * rarity ** 1.35;
        const slotLimit = group.length > 1
          ? 2 * config.radius * Math.sin(Math.PI / group.length) - 0.8
          : baseSize;
        const size = Math.min(baseSize, slotLimit);
        const angle = config.phase + index * (360 / Math.max(1, group.length));
        const radians = angle * Math.PI / 180;
        const hash = hashName(bird.scientific_name);
        layouts.push({
          bird,
          orbit,
          x: 50 + Math.cos(radians) * config.radius,
          y: 50 + Math.sin(radians) * config.radius,
          size,
          mobileSize: 52 + 48 * clamp((size - 5) / 9, 0, 1),
          tilt: (hash % 7) - 3,
          figure: layouts.length + 1,
        });
      });
    }
    return layouts;
  }

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function openDialog(bird) {
    elements.dialogImage.src = bird.image;
    elements.dialogImage.alt = `${bird.artwork.historical ? "Historical natural-history plate" : "Open illustration"} of ${bird.common_name}`;
    elements.dialogName.textContent = bird.common_name;
    elements.dialogScientific.textContent = bird.scientific_name;
    elements.dialogCount.textContent = `${numberFormat.format(bird.count)} detections`;
    elements.dialogFirst.textContent = formatDate(bird.first_heard);
    elements.dialogLast.textContent = formatDate(bird.last_heard);
    elements.dialogConfidence.textContent = `${Math.round(bird.avg_confidence * 100)}% avg · ${Math.round(bird.max_confidence * 100)}% max`;
    elements.dialogArt.textContent = `${bird.artwork.artist}, ${bird.artwork.date}`;
    elements.dialogCollection.textContent = `${bird.artwork.collection} · ${bird.artwork.license}`;
    elements.dialogNote.textContent = bird.artwork.note || "";
    elements.dialogNote.hidden = !bird.artwork.note;
    elements.dialogSource.href = bird.artwork.source_url;
    elements.dialog.showModal();
  }

  function createBirdCard(bird) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "bird-card";
    card.dataset.scientificName = bird.scientific_name;

    const frame = document.createElement("span");
    frame.className = "bird-card-frame";
    const plate = document.createElement("span");
    plate.className = "bird-plate";
    const image = document.createElement("img");
    image.width = 1200;
    image.height = 936;
    image.decoding = "async";
    const figure = textElement("span", "figure-code", "");
    figure.dataset.role = "figure";
    const stamp = textElement("span", "live-stamp", "HEARD NOW");
    stamp.dataset.role = "stamp";
    plate.append(image, figure, stamp);

    const copy = document.createElement("span");
    copy.className = "bird-card-copy";
    const names = document.createElement("span");
    const commonName = textElement("strong", "", "");
    commonName.dataset.role = "common-name";
    const scientificName = textElement("em", "", "");
    scientificName.dataset.role = "scientific-name";
    const credit = textElement("small", "plate-credit", "");
    credit.dataset.role = "credit";
    names.append(commonName, scientificName, credit);
    const count = textElement("span", "bird-card-count", "");
    count.dataset.role = "count";
    copy.append(names, count);
    frame.append(plate, copy);
    card.append(frame);
    card.addEventListener("click", () => openDialog(card._bird));
    return card;
  }

  function updateBirdCard(card, layout, index) {
    const { bird, orbit, x, y, size, mobileSize, tilt, figure } = layout;
    card._bird = bird;
    card.dataset.orbit = orbit;
    card.dataset.x = x.toFixed(3);
    card.dataset.y = y.toFixed(3);
    card.style.setProperty("--bird-x", `${x.toFixed(3)}%`);
    card.style.setProperty("--bird-y", `${y.toFixed(3)}%`);
    card.style.setProperty("--bird-size", `${size.toFixed(3)}%`);
    card.style.setProperty("--mobile-size", `${mobileSize.toFixed(2)}%`);
    card.style.setProperty("--bird-tilt", `${tilt}deg`);
    card.setAttribute(
      "aria-label",
      `${bird.common_name}, ${numberFormat.format(bird.count)} registrations, ${orbitConfig[orbit].label}. Open folio.`
    );

    const image = card.querySelector("img");
    if (image.getAttribute("src") !== bird.image) image.src = bird.image;
    image.alt = `${bird.artwork.historical ? "Historical natural-history plate" : "Open illustration"} of ${bird.common_name}`;
    image.loading = index < 8 ? "eager" : "lazy";
    card.querySelector('[data-role="figure"]').textContent = `PL. ${String(figure).padStart(3, "0")}`;
    card.querySelector('[data-role="common-name"]').textContent = bird.common_name;
    card.querySelector('[data-role="scientific-name"]').textContent = bird.scientific_name;
    card.querySelector('[data-role="credit"]').textContent = `${bird.artwork.artist} · ${bird.artwork.date}`;
    card.querySelector('[data-role="count"]').textContent = `${numberFormat.format(bird.count)} heard`;
  }

  function renderBirds(nextSpecies) {
    species = nextSpecies;
    const focusedName = document.activeElement?.classList?.contains("bird-card")
      ? document.activeElement.dataset.scientificName
      : null;
    const existing = new Map(
      Array.from(elements.wall.querySelectorAll(".bird-card"), (card) => [card.dataset.scientificName, card])
    );
    const liveNames = new Set();

    layoutBirds(species).forEach((layout, index) => {
      const name = layout.bird.scientific_name;
      liveNames.add(name);
      const card = existing.get(name) || createBirdCard(layout.bird);
      updateBirdCard(card, layout, index);
      if (!card.isConnected) elements.wall.append(card);
    });

    for (const [name, card] of existing) {
      if (!liveNames.has(name)) card.remove();
    }
    if (focusedName) {
      elements.wall.querySelector(`[data-scientific-name="${CSS.escape(focusedName)}"]`)?.focus({ preventScroll: true });
    }
  }

  function validSummary(payload) {
    return payload && typeof payload === "object" && Array.isArray(payload.species);
  }

  function newestBird(birds) {
    return birds.reduce((latest, bird) => {
      if (!latest) return bird;
      return Date.parse(bird.last_heard || "") > Date.parse(latest.last_heard || "") ? bird : latest;
    }, null);
  }

  async function loadSummary({ quiet = false } = {}) {
    if (!quiet) {
      elements.state.hidden = false;
      elements.state.classList.remove("is-error");
      elements.state.lastChild.textContent = " Calibrating the instrument…";
      elements.wall.setAttribute("aria-busy", "true");
    }
    try {
      const response = await fetch("/api/birds", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Bird feed returned ${response.status}`);
      const payload = await response.json();
      if (!validSummary(payload)) throw new Error("Bird feed returned an unexpected response");

      renderBirds(payload.species);
      elements.speciesCount.textContent = numberFormat.format(payload.species_count);
      elements.detectionCount.textContent = numberFormat.format(payload.total_detections);
      elements.lastHeard.textContent = relativeTime(payload.last_detection_at);
      elements.filteredCount.textContent = numberFormat.format(payload.one_offs_filtered);
      elements.state.hidden = payload.species.length > 0;
      elements.wall.setAttribute("aria-busy", "false");

      if (payload.species.length === 0) {
        elements.state.textContent = "No recurring detections have entered the instrument yet.";
      } else if (!elements.latestDetection.dataset.live) {
        const latest = newestBird(payload.species);
        elements.latestDetection.textContent = `Latest archive registration: ${latest.common_name} · ${formatDate(latest.last_heard)}`;
        elements.coreBird.textContent = latest.common_name;
        elements.coreTime.textContent = `last heard ${relativeTime(latest.last_heard)}`;
      }
    } catch (error) {
      if (!quiet || species.length === 0) {
        elements.state.hidden = false;
        elements.state.classList.add("is-error");
        elements.state.textContent = "The BirdNET feed is unavailable right now. The instrument will resume when the local microphone responds.";
        elements.wall.setAttribute("aria-busy", "false");
        setStreamState("offline", "offline");
      }
    }
  }

  function scheduleSummaryRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => loadSummary({ quiet: true }), 900);
  }

  function renderRecentHearings() {
    elements.recentHearings.replaceChildren();
    for (const detection of recentDetections) {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.dateTime = detection.detected_at || `${detection.date}T${detection.time}`;
      time.textContent = detection.time.slice(0, 5);
      const name = textElement("strong", "", detection.common_name);
      const confidence = textElement("small", "", `${Math.round(detection.confidence * 100)}% confidence`);
      item.append(time, name, confidence);
      elements.recentHearings.append(item);
    }
  }

  function drawDetectionRay(card, confidence) {
    window.clearTimeout(rayTimer);
    elements.detectionRay.setAttribute("x2", String(Number(card.dataset.x) * 10));
    elements.detectionRay.setAttribute("y2", String(Number(card.dataset.y) * 10));
    elements.detectionRay.style.strokeOpacity = String(0.45 + confidence * 0.55);
    elements.detectionRay.classList.remove("is-active");
    void elements.detectionRay.getBoundingClientRect();
    elements.detectionRay.classList.add("is-active");
    rayTimer = window.setTimeout(() => elements.detectionRay.classList.remove("is-active"), 2900);
  }

  function highlightDetection(detection) {
    const bird = species.find((item) => item.scientific_name === detection.scientific_name);
    elements.latestDetection.dataset.live = "true";
    if (!bird) {
      elements.latestDetection.textContent = "A first-time call is being held outside the instrument for confirmation.";
      elements.coreBird.textContent = "unconfirmed call";
      elements.coreTime.textContent = "waiting for a second registration";
      scheduleSummaryRefresh();
      return;
    }

    elements.latestDetection.textContent = `Now hearing ${detection.common_name} · ${Math.round(detection.confidence * 100)}% confidence`;
    elements.coreBird.textContent = detection.common_name;
    elements.coreTime.textContent = `registered at ${detection.time.slice(0, 5)}`;
    recentDetections = [detection, ...recentDetections].slice(0, 3);
    renderRecentHearings();

    const card = elements.wall.querySelector(`[data-scientific-name="${CSS.escape(detection.scientific_name)}"]`);
    if (card) {
      card.classList.remove("is-new");
      void card.offsetWidth;
      card.classList.add("is-new");
      card.querySelector('[data-role="stamp"]').textContent = `HEARD NOW · ${Math.round(detection.confidence * 100)}%`;
      card.querySelector('[data-role="count"]').textContent = `${numberFormat.format(bird.count + 1)} heard`;
      drawDetectionRay(card, detection.confidence);
    }
    scheduleSummaryRefresh();
  }

  function connectStream() {
    if (!("EventSource" in window)) {
      setStreamState("refreshing", "waiting");
      return;
    }
    setStreamState("connecting", "waiting");
    eventSource = new EventSource("/api/birds/stream");
    eventSource.addEventListener("ready", () => setStreamState("listening live", "live"));
    eventSource.addEventListener("detection", (event) => {
      try {
        const detection = JSON.parse(event.data);
        if (detection && typeof detection.scientific_name === "string") highlightDetection(detection);
      } catch {
        // Ignore a malformed event. The next summary refresh remains authoritative.
      }
    });
    eventSource.addEventListener("upstream-error", () => setStreamState("reconnecting", "waiting"));
    eventSource.onerror = () => setStreamState("reconnecting", "waiting");
  }

  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  window.addEventListener("pagehide", () => eventSource?.close());

  loadSummary();
  connectStream();
  window.setInterval(() => loadSummary({ quiet: true }), 60000);
})();
