/**
 * MoodMuse - Premium Music Player Component
 * 
 * Embedded YouTube player with glassmorphism design.
 * Features: Auto-play next song, queue, skip detection, intent prompts.
 * CONTINUOUS PLAYBACK - songs play automatically one after another.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { INTENT_OPTIONS, EmotionalIntent } from '@/lib/mood/intentModifier';

interface Song {
    id: string;
    title: string;
    artist: string;
    youtubeId: string;
}

interface MusicPlayerProps {
    songs: Song[];
    initialIndex?: number;
    skipCount: number;
    hasShownIntentPrompt: boolean;
    onSkip: () => void;
    onSongPlayed: () => void;
    onIntentSelect: (intent: EmotionalIntent) => void;
    onIntentPromptShown: () => void;
    onSongChange?: (index: number) => void;
    onPlaylistNearEnd?: () => void;
    onFallback?: () => void; // Handler for restricted video fallback
}

// Constants
const SKIP_THRESHOLD_SECONDS = 10;
const PLAYED_THRESHOLD_SECONDS = 30;
const SKIPS_BEFORE_PROMPT = 3;

// Declare YouTube IFrame API types
declare global {
    interface Window {
        YT: {
            Player: new (
                elementId: string,
                config: {
                    videoId: string;
                    playerVars?: Record<string, number | string>;
                    events?: {
                        onReady?: (event: YTEvent) => void;
                        onStateChange?: (event: YTStateEvent) => void;
                        onError?: (event: YTErrorEvent) => void;
                    };
                }
            ) => YTPlayer;
            PlayerState: {
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
                CUED: number;
            };
        };
        onYouTubeIframeAPIReady: () => void;
    }
}

interface YTEvent {
    target: YTPlayer;
}

interface YTStateEvent {
    data: number;
    target: YTPlayer;
}

interface YTErrorEvent {
    data: number;
    target: YTPlayer;
}

interface YTPlayer {
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    loadPlaylist: (config: { listType: string; list: string; index?: number; startSeconds?: number }) => void;
    destroy: () => void;
    getPlayerState: () => number;
}

export default function MusicPlayer({
    songs,
    initialIndex = 0,
    skipCount,
    hasShownIntentPrompt,
    onSkip,
    onSongPlayed,
    onIntentSelect,
    onIntentPromptShown,
    onSongChange,
    onPlaylistNearEnd,
    onFallback,
}: MusicPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showIntentPrompt, setShowIntentPrompt] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(false);

    const playerRef = useRef<YTPlayer | null>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const songStartTime = useRef<number>(Date.now());
    const isRetryingRef = useRef<boolean>(false);

    // Use refs to avoid stale closures in YouTube callbacks
    const currentIndexRef = useRef(currentIndex);
    const songsRef = useRef(songs);

    // Keep refs in sync
    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    // Sync with external control (when user clicks song in list below)
    useEffect(() => {
        if (initialIndex !== currentIndex) {
            setCurrentIndex(initialIndex);
        }
    }, [initialIndex]);

    useEffect(() => {
        songsRef.current = songs;
    }, [songs]);

    const currentSong = songs[currentIndex];

    // Play next song - uses refs to avoid stale closure
    const playNextSong = useCallback(() => {
        const nextIndex = currentIndexRef.current + 1;
        const songsList = songsRef.current;

        // Check if approaching end of playlist
        if (songsList.length - nextIndex <= 2 && onPlaylistNearEnd) {
            onPlaylistNearEnd();
        }

        if (nextIndex < songsList.length) {
            setCurrentIndex(nextIndex);
            onSongChange?.(nextIndex);
        } else {
            // Loop back to start
            setCurrentIndex(0);
            onSongChange?.(0);
        }
    }, [onSongChange, onPlaylistNearEnd]);

    // Handle video ended
    const handleVideoEnded = useCallback(() => {
        const playedSeconds = (Date.now() - songStartTime.current) / 1000;
        if (playedSeconds >= PLAYED_THRESHOLD_SECONDS) {
            onSongPlayed();
        }
        playNextSong();
    }, [onSongPlayed, playNextSong]);

    // Store callbacks in refs for YouTube API to access
    const handleVideoEndedRef = useRef(handleVideoEnded);
    const playNextSongRef = useRef(playNextSong);

    useEffect(() => {
        handleVideoEndedRef.current = handleVideoEnded;
    }, [handleVideoEnded]);

    useEffect(() => {
        playNextSongRef.current = playNextSong;
    }, [playNextSong]);

    // Load YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setApiLoaded(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            setApiLoaded(true);
        };

        return () => {
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
            }
        };
    }, []);

    // Initialize player when API is loaded
    useEffect(() => {
        if (!apiLoaded || !currentSong) return;

        // Clear any existing player
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                // Ignore
            }
            playerRef.current = null;
        }

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            const playerElement = document.getElementById('youtube-player');
            if (!playerElement) return;

            try {
                playerRef.current = new window.YT.Player('youtube-player', {
                    videoId: currentSong.youtubeId,
                    playerVars: {
                        autoplay: 1,
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                        origin: window.location.origin,
                    },
                    events: {
                        onReady: (event: YTEvent) => {
                            setIsPlayerReady(true);
                            songStartTime.current = Date.now();
                            event.target.playVideo();
                        },
                        onStateChange: (event: YTStateEvent) => {
                            if (event.data === window.YT.PlayerState.ENDED) {
                                handleVideoEndedRef.current();
                            }
                            if (event.data === window.YT.PlayerState.PLAYING) {
                                setIsPlaying(true);
                            } else if (event.data === window.YT.PlayerState.PAUSED) {
                                setIsPlaying(false);
                            }
                        },
                        onError: (event: YTErrorEvent) => {
                            console.error('YouTube player error:', event.data);

                            // Error codes:
                            // 2 = Invalid video ID
                            // 5 = HTML5 player error
                            // 100 = Video not found or deleted
                            // 101 = Video owner does not allow embedding
                            // 150 = Same as 101 (embedding restricted)

                            // For any playback error, skip to next song
                            if (event.data === 150 || event.data === 101 || event.data === 100 || event.data === 2) {
                                console.log(`Video unavailable (error ${event.data}), skipping to next song...`);
                                if (onFallback) onFallback(); // Trigger notification

                                // Small delay before skipping to let the notification show
                                setTimeout(() => {
                                    playNextSongRef.current();
                                }, 500);
                                return;
                            }

                            // For other errors, also skip
                            console.log('Playback error, skipping to next song');
                            playNextSongRef.current();
                        },
                    },
                });
            } catch (e) {
                console.error('Failed to create YouTube player:', e);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [apiLoaded]); // Only run when API loads, not when current song changes

    // Load new video when song changes (after player is ready)
    useEffect(() => {
        if (isPlayerReady && playerRef.current && currentSong) {
            songStartTime.current = Date.now();
            isRetryingRef.current = false; // Reset retry flag for new song
            try {
                playerRef.current.loadVideoById(currentSong.youtubeId);
            } catch (e) {
                console.error('Failed to load video:', e);
            }
        }
    }, [currentIndex, currentSong?.youtubeId, isPlayerReady]);

    // Intent prompt logic
    useEffect(() => {
        if (skipCount >= SKIPS_BEFORE_PROMPT && !hasShownIntentPrompt) {
            setShowIntentPrompt(true);
            onIntentPromptShown();
        }
    }, [skipCount, hasShownIntentPrompt, onIntentPromptShown]);

    const checkIfSkip = useCallback(() => {
        const playedSeconds = (Date.now() - songStartTime.current) / 1000;
        if (playedSeconds < SKIP_THRESHOLD_SECONDS) {
            onSkip();
        } else if (playedSeconds >= PLAYED_THRESHOLD_SECONDS) {
            onSongPlayed();
        }
    }, [onSkip, onSongPlayed]);

    const playNext = useCallback(() => {
        checkIfSkip();
        playNextSong();
    }, [checkIfSkip, playNextSong]);

    const playPrevious = useCallback(() => {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
        setCurrentIndex(prevIndex);
        onSongChange?.(prevIndex);
    }, [currentIndex, songs.length, onSongChange]);

    const playSong = useCallback((index: number) => {
        checkIfSkip();
        setCurrentIndex(index);
        onSongChange?.(index);
    }, [checkIfSkip, onSongChange]);

    const handleIntentSelect = useCallback((intent: EmotionalIntent) => {
        setShowIntentPrompt(false);
        onIntentSelect(intent);
    }, [onIntentSelect]);

    if (!currentSong) return null;

    return (
        <div className="rounded-xl overflow-hidden glass">
            {/* YouTube Player Container - Compact */}
            <div className="relative w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: '280px' }} ref={playerContainerRef}>
                <div id="youtube-player" className="absolute inset-0 w-full h-full" />
            </div>

            {/* Now Playing Info - Compact */}
            <div className="p-3 border-b border-white/5 bg-white/5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate glow-text transition-colors" style={{ color: 'var(--color-text-primary)' }}>
                            {currentSong.title}
                        </h3>
                        <p className="text-xs text-accent truncate">
                            {currentSong.artist}
                        </p>
                    </div>

                    {/* Controls - Smaller */}
                    <div className="flex items-center gap-2 ml-3">
                        <button
                            onClick={playPrevious}
                            className="p-2 hover:bg-white/10 rounded-full transition-all hover:text-accent"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Previous"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                            </svg>
                        </button>
                        <button
                            onClick={playNext}
                            className="p-2 hover:bg-white/10 rounded-full transition-all hover:text-accent"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Next"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Playing indicator */}
                {isPlaying && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex gap-0.5">
                            <span className="w-0.5 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-0.5 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-0.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-accent">Playing</span>
                    </div>
                )}
            </div>

            {/* Intent Prompt */}
            {showIntentPrompt && (
                <div className="p-4 border-b border-white/5 bg-accent/10 backdrop-blur-xl animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">✨</span>
                        <p className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                            Want to change the vibe?
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {INTENT_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleIntentSelect(option.id)}
                                className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-accent/20 
                                         border border-white/5 hover:border-accent/50
                                         rounded-full transition-all hover:text-accent"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Queue - Compact */}
            <div className="max-h-40 overflow-y-auto custom-scrollbar bg-black/5">
                <div className="sticky top-0 bg-white/5 backdrop-blur-md px-3 py-2 border-b border-white/5 z-10">
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Up Next ({songs.length - currentIndex - 1})
                    </p>
                </div>

                {songs.map((song, index) => (
                    <button
                        key={song.id}
                        onClick={() => playSong(index)}
                        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-b border-white/5 last:border-0
                          ${index === currentIndex
                                ? 'bg-accent/10'
                                : 'hover:bg-white/5'}`}
                        style={{ color: index === currentIndex ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                    >
                        <span className={`w-5 text-center text-xs font-bold 
                            ${index === currentIndex ? 'text-accent' : 'opacity-50'}`}>
                            {index === currentIndex ? '▶' : index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                                {song.title}
                            </p>
                            <p className="text-xs opacity-50 truncate">
                                {song.artist}
                            </p>
                        </div>

                        {index === currentIndex && (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse bg-shadow" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
