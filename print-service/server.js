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
// ── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
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
    const tmpFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);
    fs.writeFile(tmpFile, dataBuffer, (writeErr) => {
      if (writeErr) { resolve({ ok: false, error: writeErr.message }); return; }

      const safePrinter = printerName.replace(/'/g, "''");
      const safeFile = tmpFile.replace(/\\/g, '\\\\');

      const ps =
`try {
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
'@ -Language CSharp -ErrorAction Stop
} catch {
  if (-not ('RawPrint' -as [type])) { throw }
}
$ok = [RawPrint]::SendBytesToPrinter('${safePrinter}', '${safeFile}')
if ($ok) { Write-Output 'true' } else { Write-Output 'false:OpenPrinter failed for ${safePrinter}' }
`;
      // Use -EncodedCommand to avoid temp .ps1 file and script execution policy issues
      const encoded = Buffer.from(ps, 'utf16le').toString('base64');

      exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 15000 }, (err, stdout, stderr) => {
        fs.unlink(tmpFile, () => {});

        const output = (stdout || '').trim();
        const errOutput = (stderr || '').trim();
        console.log('[print-raw]', output || '(no output)', errOutput ? `ERR: ${errOutput}` : '');

        if (err) { resolve({ ok: false, error: errOutput || output || err.message }); return; }
        if (output.startsWith('false:')) {
          resolve({ ok: false, error: output.substring(6) });
        } else {
          resolve({ ok: output.toLowerCase() === 'true', error: output.toLowerCase() !== 'true' ? (output || 'Unknown error') : null });
        }
      });
    });
  });
}

// ── Print PNG via System.Drawing (GDI) ───────────────────────────────────────
// Works with BarTender GDI driver and all standard Windows GDI printer drivers.
// Receives base64 PNG, prints it at the driver's configured paper size (no dialog).

function printImage(printerName, imageBase64) {
  return new Promise((resolve) => {
    const pngBuf = Buffer.from(imageBase64, 'base64');
    const tmpPng = path.join(os.tmpdir(), `label_${Date.now()}.png`);

    fs.writeFile(tmpPng, pngBuf, (writeErr) => {
      if (writeErr) { resolve({ ok: false, error: writeErr.message }); return; }

      const safePrinter = printerName.replace(/'/g, "''");
      const safePath = tmpPng.replace(/\\/g, '\\\\');

      const ps = `
Add-Type -AssemblyName System.Drawing
try {
  $script:img = [System.Drawing.Image]::FromFile('${safePath}')
  $script:bmp = New-Object System.Drawing.Bitmap($script:img)
  $script:img.Dispose()
  $script:bmp.SetResolution([float]406, [float]406)

  $pd = New-Object System.Drawing.Printing.PrintDocument
  $pd.PrinterSettings.PrinterName = '${safePrinter}'
  $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $pd.add_PrintPage([System.Drawing.Printing.PrintPageEventHandler]{
    param($s, $e)
    $pb = $e.PageBounds
    Write-Host "DEBUG pb=$($pb.Width)x$($pb.Height) img=$($script:bmp.Width)x$($script:bmp.Height) dpi=$($script:bmp.HorizontalResolution)"
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $destRect = New-Object System.Drawing.Rectangle(0, 0, [int]$pb.Width, [int]$pb.Height)
    $e.Graphics.DrawImage($script:bmp, $destRect)
    $e.HasMorePages = $false
  })
  $pd.Print()
  $script:bmp.Dispose()
  $pd.Dispose()
  Write-Output 'true'
} catch {
  Write-Output "false:$($_.Exception.Message)"
}`.trim();

      const psFile = path.join(os.tmpdir(), `printimg_${Date.now()}.ps1`);
      fs.writeFile(psFile, ps, (psErr) => {
        if (psErr) { resolve({ ok: false, error: psErr.message }); return; }

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}" 2>&1`, (err, stdout) => {
          fs.unlink(tmpPng, () => {});
          fs.unlink(psFile, () => {});
          console.log('[print-image]', stdout.trim());
          if (err) { resolve({ ok: false, error: err.message }); return; }
          const lines = stdout.trim().split('\n');
          const r = lines[lines.length - 1].trim();
          if (r.startsWith('false:')) {
            resolve({ ok: false, error: r.substring(6) });
          } else {
            resolve({ ok: r === 'true' });
          }
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

  // POST /print-image  { printer: string, image: base64png }
  // Saves PNG and prints via System.Drawing (GDI) — works with BarTender GDI driver
  if (req.method === 'POST' && url.pathname === '/print-image') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { printer, image } = JSON.parse(body);
        if (!printer || !image) {
          respond(res, 400, { ok: false, error: 'printer and image are required' }, origin);
          return;
        }
        const result = await printImage(printer, image);
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
  console.log('  GET  /printers       — list installed Windows printers');
  console.log('  POST /print          — { printer, data: base64 } — send raw ESC/POS bytes');
  console.log('  POST /print-image    — { printer, image: base64png } — GDI image print (BarTender driver)');
  console.log('\nPress Ctrl+C to stop.\n');
});
