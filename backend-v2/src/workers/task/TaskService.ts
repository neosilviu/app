import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';
import { MediaConverter } from '../../services/MediaConverter';
import { DatabaseDriver } from '../../db/driver';
import { SocketManager } from '../../services/SocketManager';
import { config } from '../../config';
import winston from 'winston';

const execAsync = promisify(exec);

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'task-service' }
});

export class TaskService {
  private mediaConverter: MediaConverter;
  private db: DatabaseDriver;
  private socket: SocketManager;

  constructor() {
    this.mediaConverter = MediaConverter.getInstance();
    this.db = DatabaseDriver.getInstance();
    this.socket = SocketManager.getInstance();
  }

  // --- Printing ---

  public async listPrinters(): Promise<string[]> {
    try {
      const cmd = process.platform === 'win32' 
        ? 'powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"'
        : 'lpstat -p';
      
      const { stdout } = await execAsync(cmd);
      if (process.platform === 'win32') {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) return parsed.map((p: any) => p.Name);
        return [parsed.Name];
      }
      return stdout.split('\n').filter(Boolean);
    } catch (error) {
      logger.error('Error listing printers', error);
      return [];
    }
  }

  public async printDocument(filePath: string, printerName?: string): Promise<boolean> {
    try {
      logger.info(`Printing ${path.basename(filePath)} to ${printerName || 'default'}...`);
      
      let cmd = '';
      if (process.platform === 'win32') {
        // Use Verb Print
        cmd = `powershell -Command "Start-Process -FilePath '${filePath}' -Verb Print"`;
        if (printerName) {
           // Providing specific printer in Windows native shell execute is tricky without 3rd party tools
           // Usually relies on default printer.
           // Advanced: Set-PrintConfiguration or similar wrappers.
           // For V2 MVP, we assume default printer relies on system context or we research deeper.
           // Actually, `SumatraPDF` or similar CLI is better for specific printer.
           // We'll stick to basic verb print for now.
           logger.warn('Windows native print verb mostly sends to default printer. Printer selection might be ignored.');
        }
      } else {
        cmd = `lp -d ${printerName} "${filePath}"`;
      }

      await execAsync(cmd);
      return true;
    } catch (error) {
      logger.error('Print failed', error);
      return false;
    }
  }

  // --- Extraction ---

  public async extractArchive(inputPath: string, outputDir: string): Promise<boolean> {
    const ext = path.extname(inputPath).toLowerCase();
    await fs.ensureDir(outputDir);
    logger.info(`Extracting ${ext} archive...`);

    try {
      let cmd = '';
      if (ext === '.zip') {
        if (process.platform === 'win32') {
            cmd = `powershell -Command "Expand-Archive -Path '${inputPath}' -DestinationPath '${outputDir}' -Force"`;
        } else {
            cmd = `unzip "${inputPath}" -d "${outputDir}"`;
        }
      } else if (ext === '.rar') {
        // Assume UnRAR is in path or known location (could be config driven)
        // V1 had fallbacks
        cmd = `unrar x -y "${inputPath}" "${outputDir}"`;
      } else if (ext === '.7z') {
        cmd = `7z x "${inputPath}" -o"${outputDir}" -y`;
      } else {
        throw new Error(`Unsupported archive format: ${ext}`);
      }

      await execAsync(cmd);
      logger.info('Extraction complete');
      return true;
    } catch (error) {
      logger.error('Extraction failed', error);
      return false;
    }
  }

  // --- Conversion ---

  public async convertToPdf(inputPath: string, outputPath: string): Promise<string> {
    if (inputPath.endsWith('.html')) {
        const html = await fs.readFile(inputPath, 'utf8');
        return this.mediaConverter.htmlToPdf(html, outputPath);
    }
    // Add logic for Office docs here using LibreOffice execution if needed
    // similar to V1 logic
    return outputPath;
  }
}
