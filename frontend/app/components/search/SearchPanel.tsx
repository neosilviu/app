/**
 * SEARCH PANEL - Enterprise Level 8 Global Search UI
 * Polymorphic search across all entity types with real-time results
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, Loader2, AlertCircle, Box } from 'lucide-react';
import { cn } from '~/lib/utils';

interface SearchResult {
  id: string;
  type: string;
  displayValue: string;
  workspaceId: string;
  createdAt: string;
  match_fields: string[];
  icon: string;
  label: string;
  link: string;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
}

export default function SearchPanel({ isOpen, onClose, className }: SearchPanelProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Perform search with debounce
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json() as any;
      setResults(data.results || []);
      setSelectedIndex(-1);
    } catch (e: any) {
      console.error('[SEARCH-ERROR]', e);
      setError(e.message || 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!value.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (onClose) onClose();
        break;
    }
  };

  // Handle result selection
  const handleSelectResult = (result: SearchResult) => {
    navigate(result.link);
    setQuery('');
    setResults([]);
    if (onClose) onClose();
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24',
      className
    )}>
      <div className="w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="relative border-b border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Căutați în toți contactele, dealuri, task-uri..."
              className="w-full pl-10 pr-10 py-3 text-lg border-0 outline-none focus:ring-0"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-3 text-blue-500 w-5 h-5 animate-spin" />
            )}
            {query && !isLoading && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Results Container */}
        <div
          ref={resultsContainerRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {/* Empty State */}
          {!isLoading && results.length === 0 && !error && query.length >= 2 && (
            <div className="p-8 text-center">
              <Box className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nu au fost găsite rezultate pentru "{query}"</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <div className="divide-y">
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}`}
                  data-index={idx}
                  onClick={() => handleSelectResult(result)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                    selectedIndex === idx && 'bg-blue-50 border-l-4 border-blue-500'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Entity Type Icon */}
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600 text-sm font-medium">
                      {result.icon.substring(0, 1)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {result.displayValue}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded whitespace-nowrap">
                          {result.label}
                        </span>
                      </div>
                      {result.match_fields.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Găsit în: {result.match_fields.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="text-gray-400 flex-shrink-0">→</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-blue-500 mx-auto animate-spin" />
              <p className="text-gray-500 mt-3">Se caută...</p>
            </div>
          )}
        </div>

        {/* Footer with tips */}
        {!isLoading && results.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 flex justify-between">
            <span>Rezultate: {results.length}</span>
            <span className="text-right">↑↓ Navigare • Enter Selectare • Esc Închidere</span>
          </div>
        )}
      </div>
    </div>
  );
}
