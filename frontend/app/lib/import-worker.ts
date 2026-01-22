
/**
 * Data Import Worker
 * Handles parsing of CSV file in a background thread
 */

self.onmessage = function(e) {
  const { fileText, mapping, entityType, workspaceId } = e.data;
  
  console.log('[WORKER] Received message, fileText length:', fileText?.length || 0);
  
  try {
    if (!fileText || typeof fileText !== 'string' || fileText.trim().length === 0) {
      self.postMessage({ success: false, error: 'File is empty or invalid' });
      return;
    }

    // Detect delimiter - more robust detection
    let delimiter = ',';
    const nonEmptyLines = fileText.split(/\r?\n/).filter(l => l.trim());
    
    if (nonEmptyLines.length > 0) {
      const firstLine = nonEmptyLines[0];
      const hasComma = firstLine.includes(',');
      const hasSemicolon = firstLine.includes(';');
      const hasTab = firstLine.includes('\t');
      
      if (hasSemicolon && !hasComma) {
        delimiter = ';';
      } else if (hasTab && !hasComma) {
        delimiter = '\t';
      }
      // Default to comma if both present or only comma present
    }
    
    console.log('[WORKER] Detected delimiter:', JSON.stringify(delimiter));

    const rows = parseCSV(fileText, delimiter);
    console.log('[WORKER] Parsed rows:', rows.length);
    
    if (rows.length === 0) {
      self.postMessage({ success: false, error: 'CSV parser returned no rows' });
      return;
    }
    
    if (rows.length === 1) {
      self.postMessage({ success: false, error: 'File contains only header, no data rows' });
      return;
    }

    const headers = rows[0];
    console.log('[WORKER] Headers:', headers);
    
    // Filter out completely empty rows
    const dataRows = rows.slice(1).filter(row => {
      if (!row || row.length === 0) return false;
      // Keep row if at least one cell has content
      return row.some(cell => cell && cell.trim().length > 0);
    });
    
    console.log('[WORKER] Valid data rows after filtering:', dataRows.length);
    
    if (dataRows.length === 0) {
      self.postMessage({ success: false, error: 'No valid data rows found after filtering' });
      return;
    }

    const CHUNK_SIZE = 100;
    
    console.log(`[WORKER] Processing ${dataRows.length} rows with mapping:`, mapping);
    
    for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
      const chunk = dataRows.slice(i, i + CHUNK_SIZE);
      const processedChunk = chunk.map(row => {
        // Enterprise Level 8: Standardized UUID for imported records
        const item: any = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Map fields based on the provided mapping
        Object.entries(mapping).forEach(([entityField, csvHeader]: [string, any]) => {
          const headerIndex = headers.indexOf(csvHeader);
          if (headerIndex !== -1) {
            const value = row[headerIndex];
            if (value && value.trim()) {
              item[entityField] = value.trim();
            }
          }
        });

        return item;
      }).filter(item => Object.keys(item).length > 4); // Keep if has mapped fields beyond defaults

      const isLastChunk = i + CHUNK_SIZE >= dataRows.length;
      
      console.log(`[WORKER] Sending chunk ${Math.floor(i / CHUNK_SIZE) + 1}, done=${isLastChunk}, items=${processedChunk.length}`);
      
      self.postMessage({ 
        success: true, 
        data: processedChunk, 
        done: isLastChunk 
      });
    }

    // If no chunks were sent (empty file after headers), send done
    if (dataRows.length === 0) {
      self.postMessage({ success: true, data: [], done: true });
    }
  } catch (error: any) {
    console.error('[WORKER] Error:', error);
    self.postMessage({ success: false, error: error.message });
  }
};

function parseCSV(text: string, delimiter: string = ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.length > 0 || currentCell.trim() !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentRow.length > 0 || currentCell.trim() !== '') {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

