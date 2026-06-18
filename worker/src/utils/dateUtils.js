// Date and week utilities
// Business dates use Beijing time (UTC+8), stored as YYYY-MM-DD
// Timestamps use UTC ISO 8601

// Format date as YYYY-MM-DD (Beijing time)
export function formatDate(date) {
  if (typeof date === 'string') return date;
  const d = new Date(date);
  // Convert to Beijing time
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date in Beijing time
export function todayBeijing() {
  return formatDate(new Date());
}

// Get day of week in Chinese
export function dayOfWeekChinese(dateStr) {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const date = new Date(dateStr + 'T00:00:00+08:00');
  return days[date.getDay()];
}

// Format date with weekday for display
export function formatDateWithWeekday(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+08:00');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${dayOfWeekChinese(dateStr)}`;
}

// ISO 8601 week calculation
// Returns { year, weekNumber, yearWeek: "YYYY-WNN" }
export function getISOWeek(dateStr) {
  // Parse date string as UTC midnight (treat input as Beijing date)
  // Beijing date 2025-12-29 means UTC 2025-12-28 16:00 to 2025-12-29 16:00
  // For ISO week calculation, we need the date in UTC terms
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a date object representing the Beijing date at noon UTC
  // This avoids timezone issues across different environments
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(date.getUTCDate() + 4 - dayNum);
  
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const isoYear = thursday.getUTCFullYear();
  const yearWeek = `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
  return { year: isoYear, weekNumber, yearWeek };
}

// Get the Monday of the week containing the given date
export function getMondayOfWeek(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+08:00');
  const day = date.getDay() || 7; // Make Sunday = 7
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  return formatDate(monday);
}

// Get the Sunday of the week containing the given date
export function getSundayOfWeek(dateStr) {
  const monday = getMondayOfWeek(dateStr);
  const sunday = new Date(monday + 'T00:00:00+08:00');
  sunday.setDate(sunday.getDate() + 6);
  return formatDate(sunday);
}

// Get date range for a week given year and week number (ISO 8601)
export function getWeekDateRange(year, weekNumber) {
  // Find the first week's Monday
  const jan1 = new Date(year, 0, 1);
  const dayNum = jan1.getDay() || 7;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - dayNum + 1);
  // Adjust to first ISO week (week containing first Thursday)
  const firstThursday = new Date(firstMonday);
  firstThursday.setDate(firstMonday.getDate() + 3);
  if (firstThursday.getFullYear() !== year) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  // Add weeks
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  const mondayStr = formatDate(targetMonday);
  const sunday = new Date(targetMonday);
  sunday.setDate(targetMonday.getDate() + 6);
  const sundayStr = formatDate(sunday);
  return { startDate: mondayStr, endDate: sundayStr };
}

// Parse yearWeek string (e.g., "2025-W43")
export function parseYearWeek(yearWeek) {
  const match = yearWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  return { year: parseInt(match[1]), weekNumber: parseInt(match[2]) };
}

// Validate date format (YYYY-MM-DD)
export function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

// Validate yearWeek format (YYYY-WNN)
export function isValidYearWeek(yearWeek) {
  if (!/^\d{4}-W\d{2}$/.test(yearWeek)) return false;
  const parsed = parseYearWeek(yearWeek);
  if (!parsed) return false;
  return parsed.weekNumber >= 1 && parsed.weekNumber <= 53;
}

// Validate phone number (Chinese mobile)
export function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// Validate Chinese ID number (18 digits)
export function isValidIdNumber(idNumber) {
  return /^\d{17}[\dXx]$/.test(idNumber);
}

// Get ID prefix (first 3) and suffix (last 4)
export function getIdParts(idNumber) {
  if (!idNumber || idNumber.length < 7) return { prefix: '', suffix: '' };
  return {
    prefix: idNumber.slice(0, 3),
    suffix: idNumber.slice(-4),
  };
}

// Trim and normalize dish name (full-width to half-width, trim)
export function normalizeDishName(name) {
  if (!name) return '';
  return name.trim()
    .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
    .trim();
}
