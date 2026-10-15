import { TITLES, type Title } from './ducere';

/**
 * Load the built-in catalogue only.
 *
 * External providers are queried only in response to a user's search. Avoid
 * fetching thousands of unrelated records at app startup: that creates
 * unnecessary network load and can violate source-specific bulk-use terms.
 */
export async function loadLiveCatalog(): Promise<Title[]> {
  return TITLES;
}
