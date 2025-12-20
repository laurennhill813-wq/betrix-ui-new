export function formatMMDDYYYY(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const yyyy = String(dt.getUTCFullYear());
    return `${mm}${dd}${yyyy}`;
  } catch (e) {
    return null;
  }
}

export function getNextDaysMMDDYYYY(n) {
  const out = [];
  try {
    for (let i = 0; i < n; i++) {
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() + i);
      out.push(formatMMDDYYYY(dt));
    }
  } catch (e) {}
  return out;
}

export default { formatMMDDYYYY, getNextDaysMMDDYYYY };
