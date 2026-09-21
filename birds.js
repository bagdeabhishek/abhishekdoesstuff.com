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

  let species = [];
  let refreshTimer = null;
  let eventSource = null;

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

  function rarityFor(count, minCount, maxCount) {
    if (maxCount <= minCount) return 0.5;
    const position = (Math.log(count) - Math.log(minCount)) / (Math.log(maxCount) - Math.log(minCount));
    return Math.max(0, Math.min(1, 1 - position));
  }

  function rarityLabel(rarity) {
    if (rarity >= 0.78) return "rarely heard";
    if (rarity >= 0.45) return "occasional";
    return "often heard";
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

  function createBirdCard(bird, minCount, maxCount, index) {
    const rarity = rarityFor(bird.count, minCount, maxCount);
    const columns = Math.round(3 + rarity * 3);
    const rows = Math.round(4 + rarity * 2);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "bird-card";
    card.dataset.scientificName = bird.scientific_name;
    card.style.setProperty("--bird-columns", String(columns));
    card.style.setProperty("--bird-rows", String(rows));
    card.setAttribute("aria-label", `${bird.common_name}, heard ${numberFormat.format(bird.count)} times. Open details.`);

    const plate = document.createElement("span");
    plate.className = "bird-plate";
    const image = document.createElement("img");
    image.src = bird.image;
    image.alt = `${bird.artwork.historical ? "Historical natural-history plate" : "Open illustration"} of ${bird.common_name}`;
    image.width = 1200;
    image.height = 1200;
    image.decoding = "async";
    image.loading = index < 4 ? "eager" : "lazy";
    plate.append(image, textElement("span", "rarity-tag", rarityLabel(rarity)));

    const copy = document.createElement("span");
    copy.className = "bird-card-copy";
    const names = document.createElement("span");
    names.append(textElement("strong", "", bird.common_name), textElement("em", "", bird.scientific_name));
    const count = textElement("span", "bird-card-count", `${numberFormat.format(bird.count)} heard`);
    count.dataset.role = "count";
    copy.append(names, count);
    card.append(plate, copy);
    card.addEventListener("click", () => openDialog(bird));
    return card;
  }

  function renderBirds(nextSpecies) {
    species = nextSpecies;
    elements.wall.replaceChildren();
    if (species.length === 0) return;
    const counts = species.map((bird) => bird.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const fragment = document.createDocumentFragment();
    species.forEach((bird, index) => fragment.append(createBirdCard(bird, minCount, maxCount, index)));
    elements.wall.append(fragment);
  }

  function validSummary(payload) {
    return payload && typeof payload === "object" && Array.isArray(payload.species);
  }

  async function loadSummary({ quiet = false } = {}) {
    if (!quiet) {
      elements.state.hidden = false;
      elements.state.classList.remove("is-error");
      elements.state.lastChild.textContent = " Asking the microphone what it has heard…";
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
      elements.state.hidden = true;
      elements.wall.setAttribute("aria-busy", "false");
      if (!elements.latestDetection.dataset.live) {
        elements.latestDetection.textContent = payload.last_detection_at
          ? `Latest archive detection: ${formatDate(payload.last_detection_at)}`
          : "The microphone has no recurring bird detections yet.";
      }
    } catch (error) {
      if (!quiet || species.length === 0) {
        elements.state.hidden = false;
        elements.state.classList.add("is-error");
        elements.state.textContent = "The BirdNET feed is unavailable right now. The live gallery will return when the local microphone responds.";
        elements.wall.setAttribute("aria-busy", "false");
      }
    }
  }

  function scheduleSummaryRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => loadSummary({ quiet: true }), 900);
  }

  function highlightDetection(detection) {
    elements.latestDetection.dataset.live = "true";
    elements.latestDetection.textContent = `Now hearing ${detection.common_name} · ${Math.round(detection.confidence * 100)}% confidence`;
    const card = Array.from(elements.wall.querySelectorAll(".bird-card")).find(
      (candidate) => candidate.dataset.scientificName === detection.scientific_name
    );
    if (card) {
      card.classList.remove("is-new");
      void card.offsetWidth;
      card.classList.add("is-new");
      const count = card.querySelector('[data-role="count"]');
      const bird = species.find((item) => item.scientific_name === detection.scientific_name);
      if (count && bird) count.textContent = `${numberFormat.format(bird.count + 1)} heard`;
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
    eventSource.addEventListener("ready", () => setStreamState("live", "live"));
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
