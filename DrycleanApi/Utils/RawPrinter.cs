using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace DrycleanApi.Utils;

public static class RawPrinter
{
    // ── Win32 P/Invoke ────────────────────────────────────────────────────────
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string? pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string? pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    // ── Public API ────────────────────────────────────────────────────────────

    public static (bool ok, string error) SendBytes(string printerName, byte[] data)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (false, "Raw printing only supported on Windows");

        if (!OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
            return (false, $"Cannot open printer '{printerName}' (error {Marshal.GetLastWin32Error()})");

        try
        {
            var di = new DOCINFOA { pDocName = "DrycleanPrint", pDataType = "RAW" };
            if (StartDocPrinter(hPrinter, 1, di) == 0)
                return (false, $"StartDocPrinter failed (error {Marshal.GetLastWin32Error()})");

            StartPagePrinter(hPrinter);

            var ptr = Marshal.AllocCoTaskMem(data.Length);
            try
            {
                Marshal.Copy(data, 0, ptr, data.Length);
                WritePrinter(hPrinter, ptr, data.Length, out _);
            }
            finally
            {
                Marshal.FreeCoTaskMem(ptr);
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return (true, "");
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }

    public static List<string> ListPrinters()
    {
        var list = new List<string>();
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Print\Printers");
            if (key != null)
                list.AddRange(key.GetSubKeyNames());
        }
        catch { /* ignore */ }
        return list;
    }
}
