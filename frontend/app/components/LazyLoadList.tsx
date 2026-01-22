import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '~/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LazyLoadListProps<T> {
  fetchData: (page: number, pageSize: number) => Promise<{
    data: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }>;
  renderItem: (item: T, index: number) => React.ReactNode;
  initialPageSize?: number;
  loadMoreText?: string;
  noDataText?: string;
  className?: string;
}

/**
 * Lazy Load List Component
 * Implements "Load More" pagination for large datasets
 */
export function LazyLoadList<T extends { id: string | number }>({
  fetchData,
  renderItem,
  initialPageSize = 500,
  loadMoreText = 'Load More',
  noDataText = 'No data available',
  className = ''
}: LazyLoadListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadPage = useCallback(async (pageNum: number, append = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetchData(pageNum, initialPageSize);
      
      if (!isMounted.current) return;
      
      if (append) {
        setItems(prev => [...prev, ...response.data]);
      } else {
        setItems(response.data);
      }
      
      setHasMore(response.pagination.hasMore);
      setTotal(response.pagination.total);
      setPage(pageNum);
    } catch (error) {
      console.error('[LazyLoadList] Error loading data:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setInitialLoading(false);
      }
    }
  }, [fetchData, initialPageSize, loading]);

  useEffect(() => {
    loadPage(0, false);
  }, [fetchData, initialPageSize]);

  const handleLoadMore = () => {
    loadPage(page + 1, true);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        {noDataText}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex items-center justify-center mt-6 gap-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                {loadMoreText} ({items.length} / {total})
              </>
            )}
          </Button>
        </div>
      )}
      
      {!hasMore && items.length > 0 && (
        <div className="flex items-center justify-center mt-6 text-sm text-muted-foreground">
          Showing all {items.length} items
        </div>
      )}
    </div>
  );
}

/**
 * Example usage:
 * 
 * <LazyLoadList
 *   fetchData={async (page, pageSize) => {
 *     const response = await socket.emit('contact:fetch', { page, pageSize });
 *     return response;
 *   }}
 *   renderItem={(contact) => (
 *     <ContactCard contact={contact} />
 *   )}
 *   initialPageSize={500}
 * />
 */

