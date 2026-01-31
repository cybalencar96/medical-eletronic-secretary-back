/**
 * Date formatting utilities for Brazilian Portuguese notifications
 */

/**
 * Brazilian Portuguese day names
 */
const BRAZILIAN_DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Format date in Brazilian Portuguese style
 *
 * Returns date as "Saturday, DD/MM/YYYY at HH:MM"
 *
 * @param date - Date to format
 * @returns string - Formatted date string in Brazilian Portuguese
 *
 * @example
 * formatBrazilianDate(new Date(2025, 1, 15, 10, 0))
 * // Returns: "Sábado, 15/02/2025 às 10:00"
 */
export function formatBrazilianDate(date: Date): string {
  const dayName = BRAZILIAN_DAY_NAMES[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${dayName}, ${day}/${month}/${year} às ${hours}:${minutes}`;
}

/**
 * Format time in Brazilian Portuguese style (HH:MM)
 *
 * @param date - Date to extract time from
 * @returns string - Formatted time string
 *
 * @example
 * formatBrazilianTime(new Date(2025, 1, 15, 10, 0))
 * // Returns: "10:00"
 */
export function formatBrazilianTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
