function textContent(node) {
  if (typeof node?.value === "string") return node.value;
  if (!Array.isArray(node?.children)) return "";
  return node.children.map(textContent).join("");
}

function addProperties(node, properties) {
  node.data ??= {};
  node.data.hProperties = {
    ...(node.data.hProperties || {}),
    ...properties,
  };
}

/**
 * Keeps generated Musing markup compatible with the former marked renderer.
 * Astro passes each source pathname on the VFile, so this transform remains
 * scoped to content/musings even when more Markdown collections are added.
 */
export default function remarkMusings() {
  return (tree, file) => {
    const sourcePath = String(file?.path || file?.history?.[0] || "");
    if (sourcePath && !/[\\/]content[\\/]musings[\\/]/.test(sourcePath)) {
      return;
    }

    const children = tree.children || [];
    const firstContent = children.findIndex(
      (node) => node.type !== "yaml" && node.type !== "toml",
    );
    if (firstContent >= 0) {
      const first = children[firstContent];
      if (first.type === "heading" && first.depth === 1) {
        children.splice(firstContent, 1);
      }
    }

    const intro = children.findIndex((node) =>
      node.type === "paragraph" &&
      node.children?.[0]?.type === "emphasis" &&
      /^(?:AI-assisted|AI-generated)/i.test(textContent(node.children[0]).trim()),
    );
    if (intro >= 0) {
      // Markdown joins consecutive lines into one paragraph. Keep the status
      // and updated-date lines that follow the italic research notice.
      const paragraph = children[intro];
      paragraph.children.shift();
      if (paragraph.children[0]?.type === "text") {
        paragraph.children[0].value = paragraph.children[0].value.replace(/^\r?\n/, "");
      }
      if (!textContent(paragraph).trim()) children.splice(intro, 1);
    }

    let sectionNumber = 0;
    const visit = (node) => {
      if (node.type === "heading" && node.depth === 2) {
        sectionNumber += 1;
        addProperties(node, { id: `musing-section-${sectionNumber}` });
      } else if (node.type === "code" || node.type === "table") {
        addProperties(node, { tabindex: "0" });
      } else if (
        node.type === "paragraph" &&
        /^Status:/i.test(textContent(node).trim())
      ) {
        addProperties(node, { className: ["notebook-meta"] });
      }

      if (Array.isArray(node.children)) node.children.forEach(visit);
    };

    children.forEach(visit);
  };
}

export function rehypeFocusableBlocks() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === "element" && ["pre", "table"].includes(node.tagName)) {
        node.properties ??= {};
        node.properties.tabIndex = 0;
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(tree);
  };
}
