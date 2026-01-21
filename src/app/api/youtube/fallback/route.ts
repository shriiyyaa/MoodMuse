/**
 * MoodMuse - YouTube Fallback API
 * 
 * POST /api/youtube/fallback
 * Finds an embeddable alternative video for a song when the primary video is blocked.
 * Uses YouTube's oEmbed endpoint to verify embeddability.
 */

import { NextRequest, NextResponse } from 'next/server';

interface FallbackRequest {
    title: string;
    artist: string;
    originalId?: string;
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
 * Search YouTube for a video and return the first result's ID
 * Uses the publicly accessible search endpoint
 */
async function searchYouTubeVideo(query: string): Promise<string | null> {
    try {
        // Use YouTube's search suggest/autocomplete which returns video IDs
        // This is a workaround that doesn't require an API key
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) return null;

        const html = await response.text();

        // Extract video IDs from the search results
        // YouTube embeds video IDs in the page content
        const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

        if (videoIdMatch && videoIdMatch[1]) {
            return videoIdMatch[1];
        }

        return null;
    } catch (error) {
        console.error('YouTube search error:', error);
        return null;
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

        // Try different search queries to find an embeddable version
        const searchQueries = [
            `${body.title} ${body.artist} official audio`,
            `${body.title} ${body.artist} audio`,
            `${body.title} ${body.artist} lyrics`,
            `${body.title} ${body.artist} full song`,
            `${body.title} ${body.artist}`,
        ];

        for (const query of searchQueries) {
            const videoId = await searchYouTubeVideo(query);

            if (videoId && videoId !== body.originalId) {
                // Verify it's embeddable
                const embeddable = await isVideoEmbeddable(videoId);

                if (embeddable) {
                    return NextResponse.json({
                        success: true,
                        data: {
                            youtubeId: videoId,
                            query: query
                        }
                    });
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
