import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Converts a string into a URL-friendly slug.
 * - Converts to lowercase.
 * - Replaces spaces and underscores with hyphens.
 * - Removes non-alphanumeric characters (except hyphens).
 * - Trims leading/trailing hyphens.
 * - Removes duplicate hyphens.
 *
 * @param title The input string to slugify (e.g., a post title).
 * @param existingSlugs An optional Set of existing slugs to ensure uniqueness.
 * @returns A URL-friendly slug.
 */
export function slugify(title: string, existingSlugs?: Set<string>): string {
  let slug = title
    .toLowerCase() // Convert to lowercase
    .trim() // Trim leading/trailing whitespace
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/_/g, '-') // Replace underscores with hyphens
    .replace(/[^\w-]+/g, '') // Remove all non-word characters except hyphens
    .replace(/--+/g, '-'); // Replace multiple hyphens with a single hyphen

  // Ensure uniqueness if existingSlugs are provided
  if (existingSlugs) {
    let counter = 1;
    let uniqueSlug = slug;
    while (existingSlugs.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    slug = uniqueSlug;
  }

  return slug;
}