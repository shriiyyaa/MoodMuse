/**
 * MoodMuse - YouTube Fallback API
 * 
 * POST /api/youtube/fallback
 * Finds an embeddable alternative video for a song when the primary video is blocked.
 * Uses Invidious API (free YouTube proxy) for proper search results.
 */

import { NextRequest, NextResponse } from 'next/server';

interface FallbackRequest {
    title: string;
    artist: string;
    originalId?: string;
}

interface InvidiousVideo {
    videoId: string;
    title: string;
    author: string;
}

// List of public Invidious instances
const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://invidious.lunar.icu',
];

/**
 * Search for a video using Invidious API
 */
async function searchInvidious(query: string, instance: string): Promise<InvidiousVideo[]> {
    try {
        const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return [];

        const data = await response.json();
        return data as InvidiousVideo[];
    } catch {
        return [];
    }
}

/**
 * Check if a YouTube video is embeddable using oEmbed
 */
async function isVideoEmbeddable(videoId: string): Promise<boolean> {
    try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * POST /api/youtube/fallback
 * Find an embeddable alternative for a blocked video
 */
export async function POST(request: NextRequest) {
    try {
        const body: FallbackRequest = await request.json();

        if (!body.title || !body.artist) {
            return NextResponse.json({
                success: false,
                error: 'Title and artist are required'
            }, { status: 400 });
        }

        // Search queries to try - most specific to least specific
        const searchQueries = [
            `${body.title} ${body.artist} official audio`,
            `${body.title} ${body.artist} audio`,
            `${body.title} ${body.artist} lyrics`,
            `${body.title} ${body.artist}`,
        ];

        // Try each Invidious instance
        for (const instance of INVIDIOUS_INSTANCES) {
            for (const query of searchQueries) {
                try {
                    const results = await searchInvidious(query, instance);

                    // Filter out the original blocked video and check embeddability
                    for (const video of results.slice(0, 5)) {
                        if (video.videoId === body.originalId) continue;

                        // Check if video title contains song title (fuzzy match)
                        const videoTitleLower = video.title.toLowerCase();
                        const songTitleLower = body.title.toLowerCase();

                        if (!videoTitleLower.includes(songTitleLower.split(' ')[0])) {
                            continue; // Skip if doesn't match song title
                        }

                        // Verify embeddability
                        const embeddable = await isVideoEmbeddable(video.videoId);

                        if (embeddable) {
                            return NextResponse.json({
                                success: true,
                                data: {
                                    youtubeId: video.videoId,
                                    title: video.title,
                                    author: video.author,
                                    query: query
                                }
                            });
                        }
                    }
                } catch {
                    continue; // Try next query
                }
            }
        }

        // No embeddable alternative found
        return NextResponse.json({
            success: false,
            error: 'No embeddable alternative found'
        }, { status: 404 });

    } catch (error) {
        console.error('Fallback API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to find alternative'
        }, { status: 500 });
    }
}
