import React, { useState } from 'react';
import { SearchResult } from '../types';
import { searchContentWithGemini } from '../services/geminiService';
import { Search as SearchIcon, Download, Loader2, AlertTriangle, Info, Book, MonitorPlay } from 'lucide-react';

interface SearchProps {
  onDownload: (result: SearchResult) => Promise<void>;
  isDownloading: boolean;
}

const Search: React.FC<SearchProps> = ({ onDownload, isDownloading }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'book' | 'video'>('book');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults([]);
    try {
      const data = await searchContentWithGemini(query, searchType);
      setResults(data);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-4xl font-serif text-wh-gold mb-4 mt-8 uppercase tracking-wider border-b-2 border-wh-gold inline-block pb-2">
            Buscador Noosphere
          </h2>
          <p className="text-gray-400">
            Localiza tomos sagrados o registros de video (Dampa, Youtube).
          </p>
        </div>

        {/* Search Type Toggle */}
        <div className="flex justify-center gap-4 mb-8">
            <button 
                onClick={() => setSearchType('book')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg border transition-all ${
                    searchType === 'book' 
                    ? 'bg-wh-slate border-wh-gold text-wh-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]' 
                    : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
            >
                <Book size={20} />
                <span className="font-bold">BIBLIOGRAFÍA</span>
            </button>
            <button 
                onClick={() => setSearchType('video')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg border transition-all ${
                    searchType === 'video' 
                    ? 'bg-wh-slate border-wh-red text-wh-red shadow-[0_0_15px_rgba(136,8,8,0.3)]' 
                    : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
            >
                <MonitorPlay size={20} />
                <span className="font-bold">VOX-PICT (Videos)</span>
            </button>
        </div>

        <form onSubmit={handleSearch} className="mb-10 relative">
          <div className="relative group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchType === 'book' ? "Ej: Herejía de Horus, Eisenhorn..." : "Ej: Angron Dampa, La Voz de Horus..."}
              className="w-full bg-wh-slate/80 border-2 border-gray-700 text-white p-4 pl-12 rounded-lg focus:border-wh-gold focus:outline-none focus:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all"
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-wh-gold transition-colors" />
            <button 
                type="submit" 
                disabled={loading}
                className={`absolute right-2 top-2 bottom-2 px-6 font-bold rounded transition-colors disabled:opacity-50 ${searchType === 'video' ? 'bg-wh-red hover:bg-red-700 text-white' : 'bg-wh-gold hover:bg-yellow-500 text-black'}`}
            >
                {loading ? <Loader2 className="animate-spin" /> : 'BUSCAR'}
            </button>
          </div>
        </form>
        
        {/* Warning Banner */}
        <div className="mb-8 bg-yellow-900/20 border border-yellow-700/50 p-4 rounded flex items-start gap-3">
             <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
             <div className="text-sm text-yellow-200/80">
                <p className="font-bold mb-1">Aviso del Adeptus Administratum:</p>
                <p>
                    {searchType === 'book' 
                        ? 'La descarga genera una Reconstrucción Digital basada en conocimiento de la red.' 
                        : 'Se generará una TRANSCRIPCIÓN reconstruida del video basada en el lore conocido.'}
                </p>
             </div>
        </div>

        {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-wh-gold/70">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="font-mono text-sm animate-pulse">Consultando a los espíritus máquina...</p>
            </div>
        )}

        <div className="grid gap-4">
          {results.map((item, index) => (
            <div key={index} className="bg-wh-slate border border-gray-700 p-6 rounded-lg flex flex-col md:flex-row gap-6 hover:border-wh-gold transition-colors shadow-lg">
              <div className="flex-1">
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-wh-gold mb-2">{item.title}</h3>
                    <div className="flex gap-2">
                         {item.mediaType === 'video' && <MonitorPlay size={16} className="text-wh-red" />}
                        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 border border-gray-600 uppercase">
                            {item.mediaType === 'video' ? 'Video Log' : 'Libro'}
                        </span>
                    </div>
                </div>
                <p className="text-sm text-gray-300 font-semibold mb-3">
                    {item.mediaType === 'video' ? 'Canal' : 'Autor'}: {item.author}
                </p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{item.description}</p>
                
                <div className="flex items-center gap-4 mt-auto">
                    <button
                    onClick={() => onDownload(item)}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded font-bold text-sm transition-all ${
                        isDownloading 
                        ? 'bg-gray-700 text-gray-400 cursor-wait' 
                        : 'bg-wh-gold text-black hover:bg-yellow-400 hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]'
                    }`}
                    >
                    {isDownloading ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            {item.mediaType === 'video' ? 'TRANSCRIBIENDO...' : 'RECONSTRUYENDO...'}
                        </>
                    ) : (
                        <>
                            <Download size={18} />
                            {item.mediaType === 'video' ? 'OBTENER GUIÓN' : 'DESCARGAR'}
                        </>
                    )}
                    </button>
                </div>
              </div>
            </div>
          ))}

          {hasSearched && results.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500 bg-wh-slate/30 rounded border border-gray-800 border-dashed">
              <Info className="mx-auto mb-3 opacity-50" size={32} />
              <p>No se encontraron registros en los archivos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;