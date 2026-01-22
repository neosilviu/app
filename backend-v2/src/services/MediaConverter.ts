import puppeteer, { Browser } from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
  defaultMeta: { service: 'pdf-converter' }
});

export class MediaConverter {
  private static instance: MediaConverter;
  private browser: Browser | null = null;

  private constructor() {}

  public static getInstance(): MediaConverter {
    if (!MediaConverter.instance) {
      MediaConverter.instance = new MediaConverter();
    }
    return MediaConverter.instance;
  }

  /**
   * Initialize Puppeteer Browser (Lazy load)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Launching Puppeteer for PDF conversion...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  /**
   * Convert HTML content to PDF
   */
  public async htmlToPdf(htmlContent: string, outputPath: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      });
      logger.info(`Generated PDF at ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Error generating PDF', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Convert Image to PDF (wrapping in HTML)
   */
  public async imageToPdf(imagePath: string, outputPath: string): Promise<string> {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;

    const html = `
      <html>
        <body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center;">
          <img src="data:image/${mimeType};base64,${base64Image}" style="max-width:100%; max-height:100vh;" />
        </body>
      </html>
    `;

    return this.htmlToPdf(html, outputPath);
  }

  public async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
