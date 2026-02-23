/**
 * Service for searching and filtering parsed decisions.
 *
 * Pure service layer — operates on DecisionEntry[] arrays, no file I/O.
 * Designed to be consumed by tree providers and webview controllers.
 *
 * Ranking strategy: title match > body match > metadata match.
 */

import { DecisionEntry } from '../models';

/**
 * Criteria bundle for combined search + filter operations.
 * All fields are optional — omitted fields are not applied.
 */
export interface DecisionSearchCriteria {
    /** Free-text query matched against title, content, and author */
    query?: string;
    /** Inclusive start date (YYYY-MM-DD) */
    startDate?: string;
    /** Inclusive end date (YYYY-MM-DD) */
    endDate?: string;
    /** Author name (case-insensitive substring match) */
    author?: string;
}

/**
 * A decision paired with its relevance score from a search operation.
 */
export interface ScoredDecision {
    decision: DecisionEntry;
    score: number;
}

// Relevance weights — title matches are worth more than body/metadata
const TITLE_WEIGHT = 10;
const CONTENT_WEIGHT = 3;
const AUTHOR_WEIGHT = 5;

export class DecisionSearchService {

    /**
     * Full-text search across decisions with relevance ranking.
     * Matches against title, content, and author fields.
     * Results are sorted by score descending (most relevant first).
     *
     * Returns all decisions (unfiltered) when query is empty/whitespace.
     */
    search(decisions: DecisionEntry[], query: string): DecisionEntry[] {
        const trimmed = query.trim();
        if (!trimmed) {
            return decisions;
        }

        const scored = this.scoreDecisions(decisions, trimmed);
        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(s => s.decision);
    }

    /**
     * Filters decisions to those within an inclusive date range.
     * Compares against the decision's `date` field (YYYY-MM-DD strings).
     * Decisions without a date are excluded.
     */
    filterByDate(decisions: DecisionEntry[], startDate: Date, endDate: Date): DecisionEntry[] {
        const startKey = toDateKey(startDate);
        const endKey = toDateKey(endDate);

        return decisions.filter(d => {
            if (!d.date) { return false; }
            return d.date >= startKey && d.date <= endKey;
        });
    }

    /**
     * Filters decisions by author (case-insensitive substring match).
     * Returns all decisions when author is empty/whitespace.
     * Decisions without an author field are excluded.
     */
    filterByAuthor(decisions: DecisionEntry[], author: string): DecisionEntry[] {
        const trimmed = author.trim().toLowerCase();
        if (!trimmed) {
            return decisions;
        }

        return decisions.filter(d => {
            if (!d.author) { return false; }
            return d.author.toLowerCase().includes(trimmed);
        });
    }

    /**
     * Combined filter that chains query search, date range, and author filter.
     * Applies search first (to get ranking), then narrows with date/author.
     */
    filter(decisions: DecisionEntry[], criteria: DecisionSearchCriteria): DecisionEntry[] {
        let results = decisions;

        // Apply text search first (preserves relevance ordering)
        if (criteria.query && criteria.query.trim()) {
            results = this.search(results, criteria.query);
        }

        // Apply date range filter
        if (criteria.startDate || criteria.endDate) {
            const start = criteria.startDate || '0000-00-00';
            const end = criteria.endDate || '9999-99-99';
            results = results.filter(d => {
                if (!d.date) { return false; }
                return d.date >= start && d.date <= end;
            });
        }

        // Apply author filter
        if (criteria.author && criteria.author.trim()) {
            results = this.filterByAuthor(results, criteria.author);
        }

        return results;
    }

    // ─── Private Helpers ────────────────────────────────────────────────

    /**
     * Scores each decision against the query.
     * Splits the query into individual terms for multi-word matching.
     */
    private scoreDecisions(decisions: DecisionEntry[], query: string): ScoredDecision[] {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

        return decisions.map(decision => {
            let score = 0;
            const titleLower = (decision.title || '').toLowerCase();
            const contentLower = (decision.content || '').toLowerCase();
            const authorLower = (decision.author || '').toLowerCase();

            for (const term of terms) {
                if (titleLower.includes(term)) {
                    score += TITLE_WEIGHT;
                }
                if (contentLower.includes(term)) {
                    score += CONTENT_WEIGHT;
                }
                if (authorLower.includes(term)) {
                    score += AUTHOR_WEIGHT;
                }
            }

            return { decision, score };
        });
    }
}

/**
 * Converts a Date to a YYYY-MM-DD string using local time.
 * Avoids timezone-shifting issues that toISOString() causes.
 */
function toDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
