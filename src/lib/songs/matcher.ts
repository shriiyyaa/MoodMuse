/**
 * MoodMuse - Song Matcher
 * 
 * Matches songs from our database to the user's mood vector.
 * Uses cosine similarity to find emotionally aligned songs,
 * then generates empathetic explanations.
 * 
 * This version works fully without OpenAI, generating
 * high-quality explanations from song metadata.
 */

import { MoodResult, MoodVector } from '@/lib/mood/types';
import { Song, SongMatch, SongMatchResponse } from '@/lib/songs/types';
import { getSongsByLanguage } from '@/lib/songs/database';
import { calculateMoodSimilarity } from '@/lib/mood/analyzer';

// ============================================
// INTENT-BASED CONFIGURATION
// ============================================

// Scoring weights by intent
// CATEGORIES are PRIMARY (based on song feel/keywords)
// VECTORS are SECONDARY (auto-generated, less reliable)
const INTENT_WEIGHTS = {
    stay: { vectorWeight: 0.3, categoryWeight: 0.7, randomness: 0.0 },      // FLIPPED: category-first
    lift: { vectorWeight: 0.3, categoryWeight: 0.7, randomness: 0.1 },      // Category-first for progression
    distract: { vectorWeight: 0.1, categoryWeight: 0.9, randomness: 0.0 },  // Almost pure category
    surprise: { vectorWeight: 0.2, categoryWeight: 0.4, randomness: 0.4 }   // More random
};

/**
 * Transform the target mood vector based on user's intent.
 * - Stay: Exact match to current mood
 * - Lift: Gradually more positive/hopeful
 * - Distract: Override to high-energy positive
 * - Surprise: Random positive variety
 */
function transformMoodForIntent(vector: Partial<MoodVector>, intent: string): Partial<MoodVector> {
    switch (intent) {
        case 'stay':
            // Exact match - return as-is
            return vector;

        case 'lift':
            // Gentle lift - boost positive dimensions
            return {
                valence: Math.min(1.0, (vector.valence || 0.5) + 0.15),
                energy: Math.min(1.0, (vector.energy || 0.5) + 0.1),
                tension: Math.max(0, (vector.tension || 0.5) - 0.2),
                melancholy: Math.max(0, (vector.melancholy || 0.5) - 0.2),
                nostalgia: vector.nostalgia || 0.4,
                hope: Math.min(1.0, (vector.hope || 0.5) + 0.3),
                intensity: vector.intensity || 0.5,
                social: Math.min(1.0, (vector.social || 0.5) + 0.1)
            };

        case 'distract':
            // Complete override to upbeat/party vibe
            return {
                valence: 0.85,
                energy: 0.9,
                tension: 0.15,
                melancholy: 0.05,
                nostalgia: 0.1,
                hope: 0.8,
                intensity: 0.75,
                social: 0.85
            };

        case 'surprise':
            // Random but pleasant - avoid extremes
            return {
                valence: 0.5 + Math.random() * 0.35,
                energy: 0.3 + Math.random() * 0.5,
                tension: Math.random() * 0.3,
                melancholy: Math.random() * 0.4,
                nostalgia: 0.2 + Math.random() * 0.5,
                hope: 0.4 + Math.random() * 0.4,
                intensity: 0.3 + Math.random() * 0.5,
                social: 0.3 + Math.random() * 0.5
            };

        default:
            return vector;
    }
}

/**
 * Get scoring weights for the given intent
 */
function getIntentWeights(intent: string): { vectorWeight: number; categoryWeight: number; randomness: number } {
    return INTENT_WEIGHTS[intent as keyof typeof INTENT_WEIGHTS] || INTENT_WEIGHTS.stay;
}

// ============================================
// HEADLINE TEMPLATES - Empathetic mood headlines
// ============================================

const HEADLINE_TEMPLATES: Record<string, string[]> = {
    // Positive moods
    'joyful': ['For your radiant joy ✨', 'Music for this beautiful feeling 🌟', 'For the joy in your heart 💫'],
    'happy': ['For your happy heart 💛', 'Songs for this feeling ✨', 'For your joyful energy 🌟'],
    'ecstatic': ['For this incredible high ✨', 'Music for pure bliss 🎉', 'When life feels this good 💫'],
    'excited': ['For your buzzing energy ⚡', 'Music for this anticipation 🌟', 'For the excitement in you ✨'],
    'peaceful': ['For your quiet peace 🌙', 'Music for stillness 🕊️', 'For this calm moment ✨'],
    'hopeful': ['For the hope rising in you 🌅', 'Music for brighter days 🌟', 'For that light ahead ✨'],
    'grateful': ['For grateful hearts 💜', 'Music for thankful moments ✨', 'For counting blessings 🙏'],
    'love': ['For hearts full of love 💕', 'Music for this tenderness 💖', 'For the love you feel 💗'],
    'content': ['For quiet contentment ☁️', 'Music for gentle moments ✨', 'For feeling okay 🌙'],

    // Sad moods
    'sad': ['For your quiet storm ☁️', 'Music that understands 🌧️', 'For when it hurts 💜'],
    'melancholy': ['For this gentle ache 🌙', 'Music for bittersweet hearts 🖤', 'For the melancholy 🌧️'],
    'heartbroken': ['For shattered pieces 💔', 'Music that lets you grieve 🖤', 'For broken hearts 💜'],
    'lonely': ['For lonely nights 🌙', 'Music that sits with you 🖤', 'For feeling alone 💜'],
    'grief': ['For heavy hearts 🖤', 'Music for the grief 💜', 'For loss and love 🌙'],
    'empty': ['For hollow moments 🌙', 'Music for the emptiness 🖤', 'When you feel nothing 💜'],

    // Anxious moods
    'anxious': ['For racing thoughts 🌀', 'Music to quiet the noise 🌙', 'For anxious hearts 💜'],
    'stressed': ['For overwhelming days 😮‍💨', 'Music for letting go 🌙', 'For the pressure 💜'],
    'overwhelmed': ['For the overwhelm 🌊', 'Music when it\'s too much 💜', 'For drowning feelings 🌙'],
    'worried': ['For worried minds 🌙', 'Music for uncertain times 💜', 'For the worry 😔'],

    // Angry moods
    'angry': ['For the fire inside 🔥', 'Music that screams for you 💢', 'For burning feelings 🖤'],
    'frustrated': ['For building pressure 😤', 'Music for frustration 🔥', 'When nothing works 💢'],

    // Tired moods
    'tired': ['For weary souls 🌙', 'Music for tired hearts 😴', 'For the exhaustion 💜'],
    'exhausted': ['For complete exhaustion 😮‍💨', 'Music for burnt out days 🌙', 'When you have nothing left 💜'],
    'drained': ['For empty tanks 🌙', 'Music for drained hearts 💜', 'For depleted souls ✨'],

    // Nostalgic moods
    'nostalgic': ['For bittersweet memories 🌙', 'Music for the past 🍂', 'For remembering 💜'],
    'wistful': ['For wistful longing 🌙', 'Music for what was 🍂', 'For gentle memories 💜'],

    // Complex moods
    'confused': ['For uncertain hearts 🌀', 'Music for foggy minds 🌙', 'For the confusion 💜'],
    'lost': ['For feeling lost 🌊', 'Music for wandering souls 🌙', 'When you don\'t know 💜'],
    'restless': ['For restless energy ⚡', 'Music for uneasy nights 🌙', 'For the restlessness 🌀'],
    'vulnerable': ['For raw moments 💜', 'Music for open hearts 🌙', 'For vulnerability ✨'],
    'numb': ['For feeling nothing 🌙', 'Music for numbness 🖤', 'When you can\'t feel 💜'],
    'bittersweet': ['For bittersweet feelings 🌙', 'Music for mixed hearts 💜', 'For the in-between ✨'],

    // Default
    'default': ['For this moment ✨', 'Music for you 💜', 'For how you feel 🌙'],
};

// ============================================
// EXPLANATION TEMPLATES
// ============================================

const EXPLANATION_TEMPLATES = {
    connection: [
        "This one understands without needing words.",
        "Sometimes a song just gets it. This is that song.",
        "This one knows exactly where you are right now.",
        "A song that meets you where you are.",
    ],
    release: [
        "Let this one do the feeling for you.",
        "Sometimes you need music that feels it so you don't have to.",
        "This one carries what you can't.",
        "Let go with this one.",
    ],
    comfort: [
        "A familiar embrace in musical form.",
        "This one wraps around you like a blanket.",
        "For when you need something that doesn't demand anything.",
        "Comfort in three-minute form.",
    ],
    energy: [
        "Let this one lift you up.",
        "Sometimes you need music that moves you.",
        "For the energy you didn't know you had.",
        "This one brings the spark.",
    ],
    reflection: [
        "For sitting with your thoughts.",
        "A companion for introspection.",
        "This one lets you think.",
        "For the quiet moments of understanding.",
    ],
    catharsis: [
        "This one screams so you don't have to.",
        "Sometimes you need to break things. This song does it for you.",
        "For letting it all out.",
        "Catharsis in musical form.",
    ],
    nostalgia: [
        "For remembering while moving forward.",
        "A bridge between then and now.",
        "For the ache of beautiful memories.",
        "This one knows about time passing.",
    ],
};

/**
 * Generate a headline for the mood
 */
function generateMockHeadline(primaryMood: string): string {
    // Find matching templates
    const moodKey = primaryMood.toLowerCase().split(' ')[0]; // Get first word
    const templates = HEADLINE_TEMPLATES[moodKey] || HEADLINE_TEMPLATES['default'];

    // Pick random template
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate an empathetic explanation based on song metadata
 */
function generateMockExplanation(song: Song, primaryMood: string): string {
    // Strategies based on mood and song characteristics
    const moodLower = primaryMood.toLowerCase();

    // Build explanation from song's bestFor and themes
    if (song.bestFor && song.bestFor.length > 0) {
        const bestFor = song.bestFor[Math.floor(Math.random() * song.bestFor.length)];

        // Custom explanations based on bestFor
        const explanations: Record<string, string> = {
            'crying it out': "For when you need to let the tears come. This one won't judge.",
            'feeling misunderstood': "This one knows what it's like to be too much. It sits with you in that.",
            'late nights': "For 3am thoughts and the weight of darkness. It understands.",
            'breakthrough moments': "For when something finally clicks. This one celebrates with you.",
            'heartbreak': "For the ache that won't quit. This song has been there too.",
            'quiet pain': "For the hurt that doesn't make noise. This one hears it anyway.",
            'rainy days': "For melancholy weather, inside and out.",
            'processing anger': "Sometimes you need to feel the fire. This one fans the flames safely.",
            'driving alone': "For solitude on wheels. Just you and the road.",
            'staring at ceiling': "For those moments when all you can do is look up and exist.",
            'existential moments': "For questioning everything. This one sits in the uncertainty with you.",
            'anxiety relief': "A sonic exhale. Let this one slow your breathing.",
            'missing someone': "For the space where someone used to be.",
            'love feelings': "For hearts that are full and overflowing.",
            'romantic mood': "For tender feelings and soft hearts.",
            'bittersweet moments': "For when happiness and sadness hold hands.",
            'releasing anger': "Let this one rage for you.",
            'feeling defiant': "For when you need to stand your ground.",
            'seasonal melancholy': "For the ache that comes with changing seasons.",
            'hopeful sadness': "For sadness that still believes in tomorrow.",
            'grief': "For loss that reshapes you. This one knows.",
        };

        if (explanations[bestFor]) {
            return explanations[bestFor];
        }

        return `For ${bestFor}. This one knows the feeling.`;
    }

    // Fallback: Use themes
    if (song.themes && song.themes.length > 0) {
        const theme = song.themes[0];
        return `A song about ${theme} — it matches where you are right now.`;
    }

    // Ultimate fallback: General templates based on mood
    if (moodLower.includes('sad') || moodLower.includes('melancholy') || moodLower.includes('grief')) {
        return EXPLANATION_TEMPLATES.comfort[Math.floor(Math.random() * EXPLANATION_TEMPLATES.comfort.length)];
    }
    if (moodLower.includes('angry') || moodLower.includes('frustrat')) {
        return EXPLANATION_TEMPLATES.catharsis[Math.floor(Math.random() * EXPLANATION_TEMPLATES.catharsis.length)];
    }
    if (moodLower.includes('anxious') || moodLower.includes('stress') || moodLower.includes('overwhelm')) {
        return EXPLANATION_TEMPLATES.release[Math.floor(Math.random() * EXPLANATION_TEMPLATES.release.length)];
    }
    if (moodLower.includes('nostalgic') || moodLower.includes('wistful') || moodLower.includes('memories')) {
        return EXPLANATION_TEMPLATES.nostalgia[Math.floor(Math.random() * EXPLANATION_TEMPLATES.nostalgia.length)];
    }
    if (moodLower.includes('happy') || moodLower.includes('joy') || moodLower.includes('excited')) {
        return EXPLANATION_TEMPLATES.energy[Math.floor(Math.random() * EXPLANATION_TEMPLATES.energy.length)];
    }

    return EXPLANATION_TEMPLATES.connection[Math.floor(Math.random() * EXPLANATION_TEMPLATES.connection.length)];
}

/**
 * Match songs to a mood vector and generate explanations.
 * Uses CATEGORY-BASED MATCHING for accurate mood alignment.
 * @param excludeIds - Array of song IDs to exclude (already played songs)
 * @param intent - User's emotional intent (stay, lift, distract, surprise)
 */
export async function matchSongs(
    moodResult: MoodResult,
    language: string,
    limit: number = 5,
    excludeIds: string[] = [],
    intent: string = 'stay'
): Promise<SongMatchResponse> {
    const normalizedLang = language.toLowerCase();
    const excludeSet = new Set(excludeIds);

    // Import classifier
    const { classifySongMood, getMoodPreferences } = await import('@/lib/songs/classifier');

    // Get preferred song categories based on user mood + intent
    const preferredCategories = getMoodPreferences(moodResult.primaryMood, intent);

    // Check if this is a mixed language request
    if (normalizedLang.includes('+') || normalizedLang === 'all') {
        return matchSongsBalancedWithCategories(
            moodResult, language, limit, excludeIds, intent, preferredCategories, classifySongMood
        );
    }

    // Single language matching with categories
    let candidates = getSongsByLanguage(language);

    if (candidates.length === 0) {
        candidates = getSongsByLanguage('any');
    }

    // Filter out excluded songs
    candidates = candidates.filter(song => !excludeSet.has(song.id));

    // Get intent-based configuration
    const weights = getIntentWeights(intent);

    // Transform mood vector based on intent
    const targetVector = transformMoodForIntent(moodResult.vector, intent);

    // Score songs with INTENT-AWARE ALGORITHM
    const scoredSongs = candidates.map(song => {
        const songCategories = classifySongMood(song.title, song.artist);

        // Check if song matches preferred categories
        const categoryMatch = preferredCategories.some(pref => songCategories.includes(pref as any));
        const isNeutral = songCategories.includes('neutral' as any);

        // Vector similarity score (using transformed vector for intent)
        const vectorScore = calculateMoodSimilarity(targetVector as any, song.emotionalProfile);

        // Category score - EVERY song gets a fair base score
        let categoryScore = 0.5;  // BASE SCORE for ALL songs (ensures neutral songs have a chance)
        if (categoryMatch) {
            categoryScore = 1.0; // Strong category match
        } else if (isNeutral) {
            categoryScore = 0.6; // Neutral songs get slightly better than base
        }

        // Apply penalty for conflicting moods
        const penalty = calculateCategoryPenalty(preferredCategories, songCategories as string[]);
        categoryScore += penalty;

        // Randomness factor for surprise intent
        const randomBonus = Math.random() * weights.randomness;

        // Weighted final score based on intent
        const score = (vectorScore * weights.vectorWeight) +
            (categoryScore * weights.categoryWeight) +
            randomBonus;

        return { song, score, categories: songCategories };
    });

    // =========================================
    // BALANCED RANDOMIZATION: Quality + Variety
    // =========================================
    // Add a smaller random bonus to introduce variety while preserving quality
    scoredSongs.forEach(item => {
        // Add 0-20% random bonus - enough for variety, small enough to preserve quality ranking
        const randomBonus = Math.random() * 0.2;
        item.score += randomBonus;
    });

    // Sort by score (highest first) - now includes controlled random variation
    scoredSongs.sort((a, b) => b.score - a.score);

    let selected;

    // Special handling for 'lift' intent: create a progression
    if (intent === 'lift' && scoredSongs.length >= limit) {
        // For lift: start with mood-matching songs, end with uplifting ones
        // Re-score with progressively more hopeful targets
        const liftProgression = selectLiftProgression(scoredSongs, moodResult, limit, classifySongMood);
        selected = liftProgression;
    } else {
        // Select from top-scored songs with diversity enforcement
        // No need to shuffle - the random bonus already provides variety
        // and sorting ensures we get the best matches
        selected = selectDiverseSongs(scoredSongs, limit);
    }

    // Generate headline
    const headline = generateMockHeadline(moodResult.primaryMood);

    // Generate matches with explanations
    const matches: SongMatch[] = selected.map(item => ({
        song: item.song,
        score: Math.min(item.score, 1), // Cap at 1
        explanation: generateMockExplanation(item.song, moodResult.primaryMood),
    }));

    return {
        headline,
        songs: matches,
    };
}

/**
 * Match songs with BALANCED language distribution + categories.
 */
async function matchSongsBalancedWithCategories(
    moodResult: MoodResult,
    languageString: string,
    limit: number,
    excludeIds: string[],
    intent: string,
    preferredCategories: string[],
    classifySongMood: (title: string, artist: string) => string[]
): Promise<SongMatchResponse> {
    const excludeSet = new Set(excludeIds);

    // Parse languages
    const languages = languageString.toLowerCase() === 'all'
        ? ['english', 'hindi', 'punjabi']
        : languageString.toLowerCase().split('+').map(l => l.trim());

    // Calculate songs per language
    const songsPerLanguage = Math.ceil(limit / languages.length);

    const songsByLanguage: { song: Song; score: number; lang: string }[] = [];

    for (const lang of languages) {
        const candidates = getSongsByLanguage(lang).filter(song => !excludeSet.has(song.id));

        const scoredSongs = candidates.map(song => {
            const songCategories = classifySongMood(song.title, song.artist);
            const categoryMatch = preferredCategories.some(pref => songCategories.includes(pref));

            let score = calculateMoodSimilarity(moodResult.vector, song.emotionalProfile);
            if (categoryMatch) score += 0.5;

            // Apply GENERALIZED PENALTY
            const penalty = calculateCategoryPenalty(preferredCategories, songCategories as string[]);
            score += penalty;

            return { song, score, lang };
        });

        scoredSongs.sort((a, b) => b.score - a.score);

        const usedArtists = new Set<string>();
        let count = 0;

        for (const item of scoredSongs) {
            if (count >= songsPerLanguage) break;
            if (usedArtists.has(item.song.artist)) continue;

            songsByLanguage.push(item);
            usedArtists.add(item.song.artist);
            count++;
        }
    }

    // Interleave songs from different languages
    const interleaved: { song: Song; score: number }[] = [];
    const langQueues: Map<string, { song: Song; score: number }[]> = new Map();

    for (const item of songsByLanguage) {
        if (!langQueues.has(item.lang)) {
            langQueues.set(item.lang, []);
        }
        langQueues.get(item.lang)!.push({ song: item.song, score: item.score });
    }

    let added = 0;
    let langIndex = 0;
    const langArray = Array.from(langQueues.keys());

    while (added < limit && songsByLanguage.length > 0) {
        const currentLang = langArray[langIndex % langArray.length];
        const queue = langQueues.get(currentLang);

        if (queue && queue.length > 0) {
            interleaved.push(queue.shift()!);
            added++;
        }

        langIndex++;

        if (Array.from(langQueues.values()).every(q => q.length === 0)) break;
    }

    const finalSongs = interleaved.slice(0, limit);
    const headline = generateMockHeadline(moodResult.primaryMood);

    const matches: SongMatch[] = finalSongs.map(item => ({
        song: item.song,
        score: Math.min(item.score, 1),
        explanation: generateMockExplanation(item.song, moodResult.primaryMood),
    }));

    return {
        headline,
        songs: matches,
    };
}

/**
 * Match songs with BALANCED language distribution.
 * Ensures equal representation from each selected language.
 */
async function matchSongsBalanced(
    moodResult: MoodResult,
    languageString: string,
    limit: number,
    excludeIds: string[] = []
): Promise<SongMatchResponse> {
    const excludeSet = new Set(excludeIds);

    // Parse languages
    const languages = languageString.toLowerCase() === 'all'
        ? ['english', 'hindi', 'punjabi']
        : languageString.toLowerCase().split('+').map(l => l.trim());

    // Calculate songs per language (rounded up to ensure we have enough)
    const songsPerLanguage = Math.ceil(limit / languages.length);

    // Get top songs from each language separately
    const songsByLanguage: { song: Song; score: number; lang: string }[] = [];

    for (const lang of languages) {
        // Filter out excluded songs for each language
        const candidates = getSongsByLanguage(lang).filter(song => !excludeSet.has(song.id));
        const scoredSongs = candidates.map(song => ({
            song,
            score: calculateMoodSimilarity(moodResult.vector, song.emotionalProfile),
            lang,
        }));

        // Sort by score
        scoredSongs.sort((a, b) => b.score - a.score);

        // Select top diverse songs from this language
        const usedArtists = new Set<string>();
        let count = 0;

        for (const item of scoredSongs) {
            if (count >= songsPerLanguage) break;
            if (usedArtists.has(item.song.artist)) continue;

            songsByLanguage.push(item);
            usedArtists.add(item.song.artist);
            count++;
        }
    }

    // Interleave songs from different languages for variety
    const interleaved: { song: Song; score: number }[] = [];
    const langQueues: Map<string, { song: Song; score: number }[]> = new Map();

    // Group by language
    for (const item of songsByLanguage) {
        if (!langQueues.has(item.lang)) {
            langQueues.set(item.lang, []);
        }
        langQueues.get(item.lang)!.push({ song: item.song, score: item.score });
    }

    // Interleave: take one from each language in rotation
    let added = 0;
    let langIndex = 0;
    const langArray = Array.from(langQueues.keys());

    while (added < limit && songsByLanguage.length > 0) {
        const currentLang = langArray[langIndex % langArray.length];
        const queue = langQueues.get(currentLang);

        if (queue && queue.length > 0) {
            interleaved.push(queue.shift()!);
            added++;
        }

        langIndex++;

        // Break if all queues are empty
        if (Array.from(langQueues.values()).every(q => q.length === 0)) break;
    }

    // Trim to exact limit
    const finalSongs = interleaved.slice(0, limit);

    // Generate headline
    const headline = generateMockHeadline(moodResult.primaryMood);

    // Generate matches with explanations
    const matches: SongMatch[] = finalSongs.map(item => ({
        song: item.song,
        score: item.score,
        explanation: generateMockExplanation(item.song, moodResult.primaryMood),
    }));

    return {
        headline,
        songs: matches,
    };
}

/**
 * Select diverse songs from top matches.
 */
function selectDiverseSongs(
    scoredSongs: { song: Song; score: number }[],
    limit: number
): { song: Song; score: number }[] {
    const selected: { song: Song; score: number }[] = [];
    const usedArtists = new Set<string>();

    for (const item of scoredSongs) {
        if (selected.length >= limit) break;

        // Skip if we already have a song by this artist
        if (usedArtists.has(item.song.artist)) {
            continue;
        }

        selected.push(item);
        usedArtists.add(item.song.artist);
    }

    // Fill remaining slots if needed
    if (selected.length < limit) {
        for (const item of scoredSongs) {
            if (selected.length >= limit) break;
            if (!selected.includes(item)) {
                selected.push(item);
            }
        }
    }

    return selected;
}

/**
 * Select songs for 'lift' intent with emotional progression.
 * Creates a journey: Songs 1-2 acknowledge current mood, Songs 3-4 transition, Song 5 is uplifting.
 */
function selectLiftProgression(
    scoredSongs: { song: Song; score: number; categories?: string[] }[],
    moodResult: MoodResult,
    limit: number,
    classifySongMood: (title: string, artist: string) => string[]
): { song: Song; score: number }[] {
    const selected: { song: Song; score: number }[] = [];
    const usedArtists = new Set<string>();

    // Define the progression stages
    const stages = [
        { name: 'acknowledge', ratio: 0.4 },  // 40% - match current mood
        { name: 'transition', ratio: 0.4 },   // 40% - hopeful but gentle
        { name: 'uplift', ratio: 0.2 }        // 20% - positive destination
    ];

    // Category preferences for each stage
    const moodLower = moodResult.primaryMood.toLowerCase();
    const isSadMood = moodLower.includes('sad') || moodLower.includes('lonely') || moodLower.includes('heartbroken');

    const stageCategories = isSadMood ? {
        acknowledge: ['sad', 'heartbreak', 'melancholy'],
        transition: ['romantic', 'chill', 'nostalgia'],
        uplift: ['happy', 'motivational', 'romantic']
    } : {
        acknowledge: ['chill', 'romantic', 'nostalgia'],
        transition: ['happy', 'romantic', 'chill'],
        uplift: ['happy', 'party', 'motivational']
    };

    // Calculate songs per stage
    const counts = {
        acknowledge: Math.max(1, Math.floor(limit * stages[0].ratio)),
        transition: Math.max(1, Math.floor(limit * stages[1].ratio)),
        uplift: limit - Math.max(1, Math.floor(limit * stages[0].ratio)) - Math.max(1, Math.floor(limit * stages[1].ratio))
    };

    // Select songs for each stage
    for (const stageName of ['acknowledge', 'transition', 'uplift'] as const) {
        const stageCategs = stageCategories[stageName];
        const stageCount = counts[stageName];

        // Filter songs that match this stage's categories
        const stageCandidates = scoredSongs.filter(item => {
            if (usedArtists.has(item.song.artist)) return false;
            const songCategs = item.categories || classifySongMood(item.song.title, item.song.artist);
            return stageCategs.some(cat => songCategs.includes(cat));
        });

        // Sort by score and take top candidates for this stage
        stageCandidates.sort((a, b) => b.score - a.score);

        for (let i = 0; i < stageCount && i < stageCandidates.length; i++) {
            if (selected.length >= limit) break;
            selected.push({ song: stageCandidates[i].song, score: stageCandidates[i].score });
            usedArtists.add(stageCandidates[i].song.artist);
        }
    }

    // Fill any remaining slots
    if (selected.length < limit) {
        for (const item of scoredSongs) {
            if (selected.length >= limit) break;
            if (!usedArtists.has(item.song.artist)) {
                selected.push({ song: item.song, score: item.score });
                usedArtists.add(item.song.artist);
            }
        }
    }

    return selected;
}

/**
 * Shuffle an array in-place using Fisher-Yates algorithm.
 * Ensures variety in song selection.
 */
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Interpolate between two mood vectors.
 * t = 0.0 (start) -> 1.0 (end)
 */
function interpolateVector(start: any, end: any, t: number): any {
    const result: any = {};
    const keys = ['valence', 'energy', 'tension', 'melancholy', 'nostalgia', 'hope', 'intensity', 'social'];

    keys.forEach(key => {
        const s = start[key] || 0;
        const e = end[key] || 0;
        result[key] = s + (e - s) * t;
    });
    return result;
}


/**
 * Calculate penalty for conflicting mood categories.
 * Returns a negative number (penalty) or 0.
 */
function calculateCategoryPenalty(
    preferredCategories: string[],
    songCategories: string[]
): number {
    let penalty = 0;

    // Helper to check if ANY preferred category matches a list
    const hasPreferred = (categories: string[]) =>
        categories.some(c => preferredCategories.includes(c));

    // Helper to check if ANY song category matches a list
    const hasSongCategory = (categories: string[]) =>
        categories.some(c => songCategories.includes(c));

    // 1. SAD CONTEXT (User is sad/heartbroken)
    if (hasPreferred(['sad', 'heartbreak', 'melancholy'])) {
        // Penalty for happy/party energy
        if (hasSongCategory(['happy', 'party', 'excited', 'motivational'])) {
            penalty -= 1.0; // NUCLEAR PENALTY
        }
    }

    // 2. ROMANTIC CONTEXT (User is romantic, but NOT party/happy)
    // "Pure" romantic context
    else if (hasPreferred(['romantic']) && !hasPreferred(['party', 'happy', 'excited'])) {
        // Penalty for high energy/angry/party
        if (hasSongCategory(['party', 'angry', 'motivational', 'excited'])) {
            penalty -= 1.0;
        }
    }

    // 3. CHILL CONTEXT (User is chill/peaceful)
    else if (hasPreferred(['chill', 'peaceful'])) {
        // Penalty for high energy/intense
        if (hasSongCategory(['party', 'angry', 'excited', 'motivational', 'heartbreak'])) {
            penalty -= 1.0;
        }
    }

    // 4. ANGRY CONTEXT (User is angry)
    else if (hasPreferred(['angry', 'frustrated'])) {
        // Penalty for too soft/happy
        if (hasSongCategory(['happy', 'romantic', 'chill', 'peaceful'])) {
            penalty -= 1.0;
        }
    }

    // 5. HIGH ENERGY/PARTY CONTEXT
    else if (hasPreferred(['party', 'excited'])) {
        // Penalty for low energy/sad
        if (hasSongCategory(['sad', 'heartbreak', 'melancholy', 'chill', 'sleepy', 'nostalgia'])) {
            penalty -= 1.0;
        }
    }

    // 6. NOSTALGIC CONTEXT (New!)
    else if (hasPreferred(['nostalgia', 'nostalgic'])) {
        // Penalty for things that break the immersion
        if (hasSongCategory(['party', 'angry', 'motivational', 'excited'])) {
            penalty -= 1.0;
        }
    }

    // 7. MOTIVATIONAL CONTEXT (New!)
    else if (hasPreferred(['motivational'])) {
        // Penalty for downers
        if (hasSongCategory(['sad', 'heartbreak', 'melancholy', 'sleepy'])) {
            penalty -= 1.0;
        }
    }

    // 8. HAPPY CONTEXT (General happiness, not necessarily party)
    else if (hasPreferred(['happy', 'joy'])) {
        // Penalty for negative emotions
        if (hasSongCategory(['sad', 'heartbreak', 'angry', 'melancholy'])) {
            penalty -= 1.0;
        }
    }

    return penalty;
}

/**
 * Match songs with a GRADUAL transition from start mood to target mood.
 * Uses CATEGORY-BASED MATCHING at each step for accurate mood alignment.
 */
export async function matchSongsGradient(
    startResult: MoodResult,
    targetVector: any, // MoodVector
    language: string,
    limit: number = 5,
    excludeIds: string[] = []
): Promise<SongMatchResponse> {
    const excludeSet = new Set(excludeIds);
    const selectedMatches: SongMatch[] = [];

    // Import classifier for category-based matching
    const { classifySongMood, getMoodPreferences } = await import('@/lib/songs/classifier');

    // Parse languages for balanced checking
    const languages = language.toLowerCase() === 'all'
        ? ['english', 'hindi', 'punjabi']
        : language.toLowerCase().split('+').map(l => l.trim());

    // Helper to get candidates
    const getCandidates = () => {
        let all: Song[] = [];
        for (const lang of languages) {
            all = all.concat(getSongsByLanguage(lang));
        }
        if (all.length === 0) all = getSongsByLanguage('any');
        return all;
    };

    let pool = getCandidates();
    const finalLimit = limit;
    const usedArtists = new Set<string>();

    // Get preferred categories for the START mood (with 'stay' intent)
    const startCategories = getMoodPreferences(startResult.primaryMood, 'stay');

    for (let i = 0; i < finalLimit; i++) {
        // Calculate progress (0.0 to 1.0)
        const t = finalLimit > 1 ? i / (finalLimit - 1) : 1;

        // Interpolate the mood vector
        const currentVector = interpolateVector(startResult.vector, targetVector, t);

        let bestSong: Song | null = null;
        let bestScore = -Infinity;

        for (const song of pool) {
            if (excludeSet.has(song.id)) continue;
            if (usedArtists.has(song.artist)) continue;

            // Language balancing
            if (languages.length > 1) {
                const targetLang = languages[i % languages.length];
                if (song.language.toLowerCase() !== targetLang) continue;
            }

            // Get song's categories
            const songCategories = classifySongMood(song.title, song.artist);

            // Base score from vector similarity
            let score = calculateMoodSimilarity(currentVector, song.emotionalProfile);

            // CATEGORY BONUSES & PENALTIES
            const categoryWeight = 1 - t; // 1.0 at start, 0.0 at end

            const categoryMatch = startCategories.some(pref => songCategories.includes(pref as any));
            if (categoryMatch) {
                score += 0.5 * categoryWeight;
            }

            // Apply GENERALIZED PENALTY
            // Weighted by categoryWeight so penalties fade as we move away from start mood
            const penalty = calculateCategoryPenalty(startCategories, songCategories as string[]);
            score += penalty * categoryWeight;

            // BONUS for matching sonic mood at any point
            // (Keep existing sad song bonus logic if desired, or rely on generalized logic)
            const isSadMood = startCategories.includes('sad') || startCategories.includes('melancholy');
            const isSadSong = songCategories.includes('sad') || songCategories.includes('heartbreak');
            if (isSadMood && isSadSong && t < 0.5) {
                score += 0.3;
            }

            if (score > bestScore) {
                bestScore = score;
                bestSong = song;
            }
        }

        if (bestSong) {
            excludeSet.add(bestSong.id);
            usedArtists.add(bestSong.artist);
            selectedMatches.push({
                song: bestSong,
                score: Math.min(bestScore, 1),
                explanation: generateMockExplanation(bestSong, startResult.primaryMood)
            });
        }
    }

    const headline = generateMockHeadline(startResult.primaryMood);

    return {
        headline,
        songs: selectedMatches
    };
}

