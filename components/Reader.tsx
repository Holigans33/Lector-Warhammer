import React, { useState, useEffect, useRef } from 'react';
import { Book, Chapter } from '../types';
import { generateSpeechFromText } from '../services/geminiService';
import { ArrowLeft, Play, Pause, Loader2, Type, Volume2, SkipForward, SkipBack, Settings, Wifi, WifiOff } from 'lucide-react';

interface ReaderProps {
  book: Book;
  onBack: () => void;
}

const Reader: React.FC<ReaderProps> = ({ book, onBack }) => {
  const [fontSize, setFontSize] = useState(18);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(book.lastReadChapterIndex || 0);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [useNativeVoice, setUseNativeVoice] = useState(true); // Default to native for better offline exp
  
  // Refs for Gemini Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const currentTextRef = useRef<string>("");
  
  // Refs for Native Audio
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Fix: Access 'content' on 'book' using 'any' cast to support legacy data structure while satisfying TS
  const chapters: Chapter[] = book.chapters || [{ title: 'Capítulo Único', content: (book as any).content || '' }];
  const currentChapter = chapters[currentChapterIndex];

  useEffect(() => {
    // Init native synth
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    // Stop all audio when changing chapters or unmounting
    stopAllAudio();
    audioBufferRef.current = null;
    pauseTimeRef.current = 0;
    
    return () => {
      stopAllAudio();
    };
  }, [currentChapterIndex]);

  // Update playback rate dynamically
  useEffect(() => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.playbackRate.value = playbackRate;
    }
    // Native synthesis rate change usually requires restart for queued utterances. 
    // We update the state so next play uses new rate.
  }, [playbackRate]);

  const stopAllAudio = () => {
    // Stop Gemini Audio
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    // Stop Native Audio
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
  };

  const playNativeAudio = () => {
     if (!synthRef.current) return;
     
     // Resume if paused
     if (synthRef.current.paused) {
         synthRef.current.resume();
         setIsPlaying(true);
         return;
     }

     // Cancel any previous speaking to start fresh with new chunks
     synthRef.current.cancel();

     const text = currentChapter.content;
     if (!text) return;

     // Split text into sentences/chunks to avoid browser limits on long utterances (typically ~15s or 200 chars issues on some browsers)
     // Regex splits by punctuation (.!?) keeping the punctuation.
     const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

     chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.trim());
        utterance.lang = 'es-ES';
        utterance.rate = playbackRate;
        
        const voices = synthRef.current?.getVoices() || [];
        // Try to find a specific Spanish voice if available
        const spanishVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Google') || v.name.includes('Microsoft'))) || voices.find(v => v.lang.includes('es'));
        if (spanishVoice) utterance.voice = spanishVoice;

        // Only the last chunk triggers the end of playback state
        if (index === chunks.length - 1) {
            utterance.onend = () => setIsPlaying(false);
            utterance.onerror = () => setIsPlaying(false);
        }

        synthRef.current?.speak(utterance);
     });

     setIsPlaying(true);
  };

  const playGeminiAudio = async () => {
    if (!currentChapter.content) return;
    
    setIsLoadingAudio(true);

    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      }

      // Check if text changed or buffer missing
      if (!audioBufferRef.current || currentTextRef.current !== currentChapter.content) {
        const buffer = await generateSpeechFromText(currentChapter.content);
        if (!buffer) {
          throw new Error("Failed to generate audio");
        }
        audioBufferRef.current = buffer;
        currentTextRef.current = currentChapter.content;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.playbackRate.value = playbackRate;
      source.connect(audioContextRef.current.destination);
      
      const offset = pauseTimeRef.current % (audioBufferRef.current.duration || 1);
      source.start(0, offset);
      startTimeRef.current = audioContextRef.current.currentTime - offset;

      sourceNodeRef.current = source;
      
      source.onended = () => {
        setIsPlaying(false);
        pauseTimeRef.current = 0;
      };

      setIsPlaying(true);
    } catch (error) {
      console.error("Playback error:", error);
      alert("Error en el Vox Module Neural. Cambiando a modo Nativo.");
      setUseNativeVoice(true);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (useNativeVoice) {
         if (synthRef.current) synthRef.current.pause();
         setIsPlaying(false);
      } else {
         if (audioContextRef.current) {
            pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
         }
         stopAllAudio(); // Gemini needs full stop usually for precise controls without complexity
      }
    } else {
      if (useNativeVoice) {
        playNativeAudio();
      } else {
        playGeminiAudio();
      }
    }
  };

  const nextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
        setCurrentChapterIndex(prev => prev + 1);
        window.scrollTo(0,0);
    }
  };

  const prevChapter = () => {
    if (currentChapterIndex > 0) {
        setCurrentChapterIndex(prev => prev - 1);
        window.scrollTo(0,0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#e8e4d9] text-gray-900 animate-in slide-in-from-right duration-300">
      {/* Reader Header */}
      <div className="bg-wh-slate text-white p-3 shadow-md flex items-center justify-between sticky top-0 z-30">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
            <h2 className="font-serif font-bold text-wh-gold text-sm md:text-base truncate max-w-[200px] text-center">
                {book.title}
            </h2>
            <span className="text-xs text-gray-400">{currentChapter.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 hover:bg-white/10 rounded">
            <Type size={14} />
          </button>
          <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-2 hover:bg-white/10 rounded">
            <Type size={18} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-4xl mx-auto w-full relative">
        <div 
            className="prose prose-lg max-w-none font-serif leading-relaxed text-gray-800 text-justify"
            style={{ fontSize: `${fontSize}px` }}
        >
            <h1 className="text-3xl font-bold text-center text-wh-red mb-8 font-serif">{currentChapter.title}</h1>
            
            {currentChapter.content ? (
                currentChapter.content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4">{paragraph}</p>
                ))
            ) : (
                <p className="italic text-gray-500 text-center mt-20">Datos corruptos...</p>
            )}
        </div>
        
        {/* Chapter Navigation Inline */}
        <div className="flex justify-between mt-12 mb-24 pt-8 border-t border-gray-300">
            <button 
                onClick={prevChapter}
                disabled={currentChapterIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded text-wh-slate hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
                <SkipBack size={18} /> Anterior
            </button>
            <button 
                onClick={nextChapter}
                disabled={currentChapterIndex === chapters.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded text-wh-slate hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
                Siguiente <SkipForward size={18} />
            </button>
        </div>
      </div>

      {/* Audio Controls Footer */}
      <div className="bg-wh-slate text-white p-3 border-t border-wh-gold sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
        
        {/* Settings Popup */}
        {showSettings && (
            <div className="absolute bottom-full right-4 mb-2 bg-wh-dark border border-wh-gold p-4 rounded-lg shadow-xl w-64 animate-in slide-in-from-bottom-2">
                <div className="mb-4">
                    <label className="text-xs text-wh-gold font-bold mb-2 block">Velocidad: {playbackRate.toFixed(1)}x</label>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.1" 
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                        className="w-full accent-wh-red"
                    />
                </div>
                
                <div className="border-t border-gray-700 pt-3">
                    <label className="text-xs text-wh-gold font-bold mb-2 block">Tipo de Voz</label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { stopAllAudio(); setUseNativeVoice(true); }}
                            className={`flex-1 text-xs py-2 rounded border ${useNativeVoice ? 'bg-wh-red border-wh-red text-white' : 'border-gray-600 text-gray-400'}`}
                        >
                            <WifiOff size={12} className="inline mr-1"/> Nativa
                        </button>
                        <button 
                            onClick={() => { stopAllAudio(); setUseNativeVoice(false); }}
                            className={`flex-1 text-xs py-2 rounded border ${!useNativeVoice ? 'bg-wh-gold border-wh-gold text-black' : 'border-gray-600 text-gray-400'}`}
                        >
                            <Wifi size={12} className="inline mr-1"/> Neural
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 italic">
                        {useNativeVoice ? "Usa el motor del dispositivo. Funciona Offline." : "Usa Gemini AI. Requiere internet. Mayor calidad."}
                    </p>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center max-w-2xl mx-auto relative">
            
            {/* Left: Info */}
            <div className="w-1/3 hidden md:flex items-center gap-2 text-wh-gold">
                {isPlaying && (
                    <div className="flex items-center gap-2 animate-pulse">
                        <Volume2 size={16} />
                        <span className="text-xs">{useNativeVoice ? 'Voz Nativa' : 'Voz Neural'}</span>
                    </div>
                )}
            </div>

            {/* Center: Play Controls */}
            <div className="flex items-center gap-6 justify-center w-full md:w-1/3">
                 <button onClick={prevChapter} disabled={currentChapterIndex === 0} className="text-gray-400 hover:text-white disabled:opacity-20">
                    <SkipBack size={20} />
                 </button>
                 
                 <button
                    onClick={handlePlayPause}
                    disabled={isLoadingAudio || !currentChapter.content}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isLoadingAudio 
                        ? 'bg-gray-700 cursor-wait' 
                        : isPlaying 
                            ? 'bg-wh-red hover:bg-red-700 shadow-[0_0_10px_rgba(220,38,38,0.5)]' 
                            : 'bg-wh-gold hover:bg-yellow-500 text-black shadow-[0_0_10px_rgba(212,175,55,0.5)]'
                    }`}
                >
                    {isLoadingAudio ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : isPlaying ? (
                        <Pause size={20} fill="currentColor" />
                    ) : (
                        <Play size={20} fill="currentColor" className="ml-1" />
                    )}
                </button>

                <button onClick={nextChapter} disabled={currentChapterIndex === chapters.length - 1} className="text-gray-400 hover:text-white disabled:opacity-20">
                    <SkipForward size={20} />
                 </button>
            </div>

            {/* Right: Settings */}
            <div className="w-1/3 flex justify-end">
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded hover:bg-white/10 transition-colors ${showSettings ? 'text-wh-gold' : 'text-gray-400'}`}
                    title="Configuración de Voz"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;