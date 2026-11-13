/**
 * Local Print Service — runs on the user's PC (port 9100)
 * Accepts raw ESC/POS or CPCL bytes and sends them to a Windows printer silently.
 * No npm dependencies — uses only built-in Node.js modules.
 */
const http = require('http');
const { exec, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = 9100;
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function respond(res, status, body, origin) {
  res.writeHead(status, corsHeaders(origin));
  res.end(JSON.stringify(body));
}

// ── List printers via PowerShell ──────────────────────────────────────────────

function listPrinters() {
  return new Promise((resolve) => {
    const ps = `Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json`;
    exec(`powershell -NoProfile -Command "${ps}"`, (err, stdout) => {
      if (err) { resolve([]); return; }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        // PowerShell may return a plain string for single printer
        const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
        resolve(lines);
      }
    });
  });
}

// ── Send raw bytes to printer via PowerShell + .NET RawPrinterHelper ─────────
// Uses System.Drawing.Printing or a temp file + copy /b trick

function printRaw(printerName, dataBuffer) {
  return new Promise((resolve) => {
    // Write bytes to a temp file then use "copy /b" to send to printer port
    const tmpFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);
    fs.writeFile(tmpFile, dataBuffer, (writeErr) => {
      if (writeErr) { resolve({ ok: false, error: writeErr.message }); return; }

      // PowerShell script: use .NET to send raw bytes to named printer
      const ps = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    public static bool SendBytesToPrinter(string printerName, string filePath) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RawPrint";
        di.pDataType = "RAW";
        byte[] bytes = System.IO.File.ReadAllBytes(filePath);
        int written;
        StartDocPrinter(hPrinter, 1, di);
        StartPagePrinter(hPrinter);
        IntPtr ptr = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, ptr, bytes.Length);
        WritePrinter(hPrinter, ptr, bytes.Length, out written);
        Marshal.FreeCoTaskMem(ptr);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return true;
    }
}
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
'@ -Language CSharp
$ok = [RawPrint]::SendBytesToPrinter("${printerName}", "${tmpFile}")
Write-Output $ok
`.trim();

      const psFile = path.join(os.tmpdir(), `rawprint_${Date.now()}.ps1`);
      fs.writeFile(psFile, ps, (psWriteErr) => {
        if (psWriteErr) { resolve({ ok: false, error: psWriteErr.message }); return; }

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, (err2, stdout2) => {
          // Cleanup temp files
          fs.unlink(tmpFile, () => {});
          fs.unlink(psFile, () => {});

          if (err2) { resolve({ ok: false, error: err2.message }); return; }
          const result = stdout2.trim().toLowerCase();
          resolve({ ok: result === 'true', error: result !== 'true' ? stdout2.trim() : null });
        });
      });
    });
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const origin = req.headers['origin'] || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /printers
  if (req.method === 'GET' && url.pathname === '/printers') {
    const printers = await listPrinters();
    respond(res, 200, { printers }, origin);
    return;
  }

  // POST /print  { printer: string, data: base64string }
  if (req.method === 'POST' && url.pathname === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { printer, data } = JSON.parse(body);
        if (!printer || !data) {
          respond(res, 400, { ok: false, error: 'printer and data are required' }, origin);
          return;
        }
        const bytes = Buffer.from(data, 'base64');
        const result = await printRaw(printer, bytes);
        respond(res, result.ok ? 200 : 500, result, origin);
      } catch (e) {
        respond(res, 400, { ok: false, error: e.message }, origin);
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && url.pathname === '/') {
    respond(res, 200, { status: 'ok', service: 'DrycleanPrintService', port: PORT }, origin);
    return;
  }

  respond(res, 404, { error: 'Not found' }, origin);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nDryclean Print Service running at http://127.0.0.1:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /printers  — list installed Windows printers');
  console.log('  POST /print     — { printer, data: base64 } — send raw bytes silently');
  console.log('\nPress Ctrl+C to stop.\n');
});
