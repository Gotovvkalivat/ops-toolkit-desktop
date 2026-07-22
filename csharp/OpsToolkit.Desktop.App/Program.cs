using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace OpsToolkit.Desktop.App;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainWindow());
    }
}

internal sealed class MainWindow : Form
{
    private const int ApplicationPort = 48731;
    private static readonly string ApplicationVersion = typeof(MainWindow).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
    private readonly WebView2 _browser = new() { Dock = DockStyle.Fill };
    private readonly Label _loading = new()
    {
        Dock = DockStyle.Fill,
        Text = "Запуск OPS Toolkit...",
        TextAlign = ContentAlignment.MiddleCenter,
        Font = new Font("Segoe UI", 12, FontStyle.Bold)
    };
    private Process? _server;

    public MainWindow()
    {
        Text = "OPS Toolkit";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1100, 720);
        Size = new Size(1500, 940);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(_loading);
        Shown += async (_, _) => await StartAsync();
        FormClosing += (_, _) => StopServer();
    }

    private async Task StartAsync()
    {
        try
        {
            var url = $"http://127.0.0.1:{ApplicationPort}/";
            if (!await IsToolkitServerReadyAsync(url))
            {
                if (!IsPortAvailable(ApplicationPort))
                    throw new InvalidOperationException($"Порт {ApplicationPort} занят другим приложением. Закройте его и запустите OPS Toolkit снова.");
                _server = StartServer(ApplicationPort);
                await WaitForServerAsync(url, TimeSpan.FromSeconds(25));
            }
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OPS Toolkit", "WebView2");
            Directory.CreateDirectory(userData);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
            await _browser.EnsureCoreWebView2Async(environment);
            _browser.CoreWebView2.Settings.AreDevToolsEnabled = true;
            _browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _browser.Source = new Uri(url);
            Controls.Clear();
            Controls.Add(_browser);
        }
        catch (Exception error)
        {
            _loading.Text = $"Не удалось запустить OPS Toolkit.\n\n{error.Message}";
        }
    }

    private static bool IsPortAvailable(int port)
    {
        try
        {
            using var listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            return true;
        }
        catch (SocketException)
        {
            return false;
        }
    }

    private static async Task<bool> IsToolkitServerReadyAsync(string baseUrl)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(700) };
            using var response = await client.GetAsync(new Uri(new Uri(baseUrl), "api/health"));
            if (!response.IsSuccessStatusCode) return false;
            await using var stream = await response.Content.ReadAsStreamAsync();
            using var document = await JsonDocument.ParseAsync(stream);
            var root = document.RootElement;
            return root.TryGetProperty("mode", out var mode)
                && string.Equals(mode.GetString(), "desktop-csharp", StringComparison.OrdinalIgnoreCase)
                && root.TryGetProperty("version", out var version)
                && string.Equals(version.GetString(), ApplicationVersion, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static Process StartServer(int port)
    {
        var serverPath = ResolveServerPath();
        var startInfo = new ProcessStartInfo(serverPath, "--no-open")
        {
            WorkingDirectory = Path.GetDirectoryName(serverPath)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        startInfo.Environment["OPS_TOOLKIT_PORT"] = port.ToString();
        return Process.Start(startInfo) ?? throw new InvalidOperationException("Локальный сервер не запустился");
    }

    private static string ResolveServerPath()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "server", "OpsToolkit.Desktop.Server.exe"),
            Path.Combine(AppContext.BaseDirectory, "OpsToolkit.Desktop.Server.exe"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "OpsToolkit.Desktop.Server", "bin", "Release", "net8.0", "win-x64", "OpsToolkit.Desktop.Server.exe"))
        };
        return candidates.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException("Не найден OpsToolkit.Desktop.Server.exe. Соберите приложение через publish-desktop-app.cmd.");
    }

    private static async Task WaitForServerAsync(string baseUrl, TimeSpan timeout)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var response = await client.GetAsync(new Uri(new Uri(baseUrl), "api/health"));
                if (response.IsSuccessStatusCode) return;
            }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) { }
            await Task.Delay(180);
        }
        throw new TimeoutException("Локальный сервер не ответил за 25 секунд");
    }

    private void StopServer()
    {
        try
        {
            if (_server is { HasExited: false }) _server.Kill(entireProcessTree: true);
        }
        catch { }
        _server?.Dispose();
    }
}
