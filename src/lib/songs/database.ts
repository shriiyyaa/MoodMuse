/**
 * MoodMuse - VERIFIED Song Database (FRESH REBUILD)
 * 
 * This database has been cleared for a total rebuild starting with English.
 * All legacy files have been deprecated.
 */

import { Song } from '@/lib/songs/types';
import { ENGLISH_FRESH } from '@/lib/songs/english-fresh';
import { hindiFreshSongs } from '@/lib/songs/hindi-fresh';
import { punjabiFreshSongs } from '@/lib/songs/punjabi-fresh';

/**
 * Combined song database (Fresh Core)
 */
const ALL_SONGS_RAW: Song[] = [
    ...ENGLISH_FRESH,
    ...hindiFreshSongs,
    ...punjabiFreshSongs
];

/**
 * Deduplicate songs by title + artist combination
 */
function deduplicateSongs(songs: Song[]): Song[] {
    const seen = new Set<string>();
    return songs.filter(song => {
        const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Lazy-loaded song database
 */
let _cachedDatabase: Song[] | null = null;

function getSongDatabase(): Song[] {
    if (_cachedDatabase === null) {
        _cachedDatabase = deduplicateSongs(ALL_SONGS_RAW);
    }
    return _cachedDatabase;
}

/**
 * Main song database - lazy loaded
 */
export const SONG_DATABASE: Song[] = getSongDatabase();

export function getSongsByLanguage(language: string): Song[] {
    const db = getSongDatabase();
    const normalizedLang = language.toLowerCase();

    if (normalizedLang === 'any' || normalizedLang === 'all') {
        return db;
    }

    if (normalizedLang.includes('+')) {
        const languages = normalizedLang.split('+').map(l => l.trim());
        return db.filter(
            song => languages.includes(song.language.toLowerCase())
        );
    }

    return db.filter(
        song => song.language.toLowerCase() === normalizedLang
    );
}

export function getSongById(id: string): Song | undefined {
    return SONG_DATABASE.find(song => song.id === id);
}

export function getSongCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const song of SONG_DATABASE) {
        counts[song.language] = (counts[song.language] || 0) + 1;
    }
    return counts;
}
