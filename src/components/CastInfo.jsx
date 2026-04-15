import React, { useState, useEffect, useRef } from 'react';
import { Users, User, AlertCircle, Loader2 } from 'lucide-react';
import useThemeStore from '../lib/zustand/themeStore';

// TMDB API details
const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185';

const CastInfo = ({ 
  cast: initialCast = [], 
  director: initialDirector = null, 
  title, 
  mediaType = 'movie' 
}) => {
  const { primary } = useThemeStore();
  
  const [enrichedCast, setEnrichedCast] = useState([]);
  const [enrichedDirector, setEnrichedDirector] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const abortControllerRef = useRef(null);

  const fetchFromTMDB = async (endpoint, params = {}) => {
    const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url.toString(), { signal: abortControllerRef.current?.signal });
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }
    return response.json();
  };

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setEnrichedCast([]);
    setEnrichedDirector(null);
    setError(null);
    
    if (!title || !TMDB_API_KEY || TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
      setEnrichedCast(Array.isArray(initialCast) ? initialCast : []);
      setEnrichedDirector(initialDirector);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    const fetchCastWithImages = async () => {
      try {
        const searchEndpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';
        const searchParams = { query: title, include_adult: false };
        const searchData = await fetchFromTMDB(searchEndpoint, searchParams);
        
        if (!searchData.results || searchData.results.length === 0) {
          throw new Error(`No ${mediaType} found with title "${title}"`);
        }
        
        const mediaId = searchData.results[0].id;
        
        const creditsEndpoint = mediaType === 'movie' 
          ? `/movie/${mediaId}/credits` 
          : `/tv/${mediaId}/credits`;
        const creditsData = await fetchFromTMDB(creditsEndpoint);
        
        const castWithImages = (creditsData.cast || [])
          .slice(0, 15)
          .map(actor => ({
            id: actor.id,
            name: actor.name,
            character: actor.character,
            profile_path: actor.profile_path,
            profileUrl: actor.profile_path 
              ? `${TMDB_IMAGE_BASE_URL}${actor.profile_path}` 
              : null
          }));
        
        const directorObj = (creditsData.crew || []).find(member => member.job === 'Director');
        const directorWithImage = directorObj ? {
          id: directorObj.id,
          name: directorObj.name,
          profile_path: directorObj.profile_path,
          profileUrl: directorObj.profile_path 
            ? `${TMDB_IMAGE_BASE_URL}${directorObj.profile_path}` 
            : null,
          job: 'Director'
        } : null;
        
        setEnrichedCast(castWithImages);
        setEnrichedDirector(directorWithImage);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('TMDB fetch error:', err);
          setError(err.message || 'Failed to load cast images');
          setEnrichedCast(Array.isArray(initialCast) ? initialCast : []);
          setEnrichedDirector(initialDirector);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchCastWithImages();
    
    return () => {
      controller.abort();
    };
  }, [title, mediaType, initialCast, initialDirector]);

  const displayCast = enrichedCast.length > 0 ? enrichedCast : (Array.isArray(initialCast) ? initialCast : []);
  const displayDirector = enrichedDirector !== null ? enrichedDirector : initialDirector;
  
  if ((!displayCast || displayCast.length === 0) && !displayDirector) {
    return null;
  }

  const getActorName = (actor) => {
    if (typeof actor === 'string') return actor;
    return actor?.name || actor?.actor || actor?.original_name || 'Unknown';
  };

  const getCharacterName = (actor) => {
    if (typeof actor === 'object' && (actor.character || actor.role)) {
      return actor.character || actor.role;
    }
    return null;
  };

  const getProfileUrl = (actor) => {
    if (typeof actor === 'object' && actor.profileUrl) return actor.profileUrl;
    if (typeof actor === 'object' && actor.profile_path) return `${TMDB_IMAGE_BASE_URL}${actor.profile_path}`;
    if (typeof actor === 'object' && (actor.image || actor.photo || actor.img)) return actor.image || actor.photo || actor.img;
    return null;
  };

  // Skip rendering Director for now since your original UI only had the cast block
  const renderDirector = () => {
    return null;
  };

  const renderCast = () => {
    if (!displayCast.length) return null;
    
    return (
      <div style={{ paddingTop: '8px' }}>
        <h2 style={{ margin: '0 0 10px 14px', fontSize: '17px', fontWeight: 700, color: '#fff' }}>Cast</h2>
        <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingLeft: '14px', paddingRight: '6px', paddingBottom: '10px' }}>
          {displayCast.map((actor, i) => {
            const actorName = getActorName(actor);
            const character = getCharacterName(actor);
            const profileImage = getProfileUrl(actor);
            const uniqueKey = typeof actor === 'object' && actor.id ? actor.id : i;
            // Safe initials extraction
            const safeName = actorName || '??';
            const initials = safeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            
            return (
              <div key={uniqueKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '68px', maxWidth: '68px' }}>
                <div style={{ width: '66px', height: '66px', borderRadius: '50%', overflow: 'hidden', background: '#1f2937', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt={actorName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { 
                        e.currentTarget.style.display = 'none'; 
                        if (e.currentTarget.nextSibling) {
                          e.currentTarget.nextSibling.style.display = 'flex'; 
                        }
                      }}
                    />
                  ) : null}
                  {/* Fallback to initials */}
                  <div style={{ display: profileImage ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                    <span style={{ fontSize: '17px', fontWeight: 700, color: '#9ca3af' }}>{initials}</span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {actorName}
                </span>
                {character && (
                  <span style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                    {character}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ paddingTop: '8px' }}>
        <h2 style={{ margin: '0 0 10px 14px', fontSize: '17px', fontWeight: 700, color: '#fff' }}>Cast</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: '20px', gap: '8px' }}>
          <Loader2 size={20} color={primary} className="animate-spin" />
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {renderCast()}
    </>
  );
};

export default CastInfo;