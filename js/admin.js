function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function tsToISO(t) {
  if (!t) return "";
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  if (t.seconds) return new Date(t.seconds * 1000).toISOString();
  return "";
}

export function exportCSV(posts) {
  const headers = ["id", "title", "description", "category", "authorName", "authorId", "likes", "pinned", "linkUrl", "createdAt", "updatedAt"];
  const rows = [headers.join(",")];
  for (const p of posts) {
    rows.push([
      p.id, p.title, p.description, p.category, p.authorName, p.authorId,
      (p.likes || []).length, p.pinned ? "true" : "false",
      p.linkUrl, tsToISO(p.createdAt), tsToISO(p.updatedAt),
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `posts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
