// Placeholder for QR code generation
// In real build, we might need 'qrcode' package
import * as fs from 'fs-extra';
import * as path from 'path';
import { SocketManager } from '../../services/SocketManager';
import { config } from '../../config';

export class QRHandler {
  private socket: SocketManager;
  private qrDir: string;

  constructor() {
    this.socket = SocketManager.getInstance();
    this.qrDir = path.join(config.paths.inbox, 'qr');
    fs.ensureDirSync(this.qrDir);
  }

  public async handle(qrData: string): Promise<void> {
    // 1. Emit to Frontend via Socket
    this.socket.emitToNamespace('/whatsapp', 'qr', { data: qrData, timestamp: Date.now() });

    // 2. Save to file (optional, for debugging or static serving)
    const filePath = path.join(this.qrDir, 'latest.txt');
    await fs.writeFile(filePath, qrData);
  }
}
