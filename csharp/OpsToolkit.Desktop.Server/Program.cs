using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

const string AppVersion = "0.5.2";

var publicPath = ResolvePublicPath();
var port = FindAvailablePort(ReadPort());
var debugEnabled = args.Contains("--debug", StringComparer.OrdinalIgnoreCase)
    || string.Equals(Environment.GetEnvironmentVariable("OPS_TOOLKIT_DEBUG"), "1", StringComparison.OrdinalIgnoreCase);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = publicPath
});
builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.WriteIndented = false;
});

var runtime = new ApiRuntime(AppVersion, debugEnabled);
builder.Services.AddSingleton(runtime);

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.MapGet("/api/health", (ApiRuntime api) => Results.Json(new
{
    ok = true,
    version = AppVersion,
    mode = "desktop-csharp",
    debug = debugEnabled,
    cache = api.Cache.Summary(),
    limits = api.Limits()
}));

app.MapGet("/api/info", (ApiRuntime api) => Results.Json(new { ok = true, data = api.Info() }));

var apiRoutes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["/api/auth/login"] = "auth",
    ["/api/reference/delivery-companies"] = "deliveryCompanies",
    ["/api/clients/search"] = "searchUser",
    ["/api/addresses/resolve"] = "resolveAddress",
    ["/api/tariffs/calculate"] = "calculate",
    ["/api/orders/create"] = "createOrder",
    ["/api/orders/cancel"] = "cancelOrder",
    ["/api/cache/clear"] = "clearCache",
    ["/api/cache/status"] = "calculationCacheStatus"
};
app.MapGet("/api", () => Results.Json(new
{
    name = "OPS Toolkit Local API",
    version = AppVersion,
    endpoints = apiRoutes.Select(route => new { method = "POST", path = route.Key, action = route.Value }),
    diagnostics = new[] { "/api/health", "/api/debug/status", "/api/debug/requests", "/api/debug/outbound", "/debug/requests.html", "/api/debug/self-test" }
}));
foreach (var route in apiRoutes)
{
    var action = route.Value;
    app.MapPost(route.Key, (HttpContext context, ApiRuntime api) => ExecuteApiActionAsync(context, api, action));
}

app.MapPost("/api/rpc", async (HttpContext context, ApiRuntime api) =>
{
    var traceId = api.Traces.NextId();
    var started = Stopwatch.GetTimestamp();
    string action = "unknown";
    JsonObject payload = [];
    try
    {
        var request = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted) as JsonObject
            ?? throw new ApiException("Некорректное тело RPC-запроса", "INVALID_REQUEST", 400);
        action = Value.String(request, "action");
        payload = request["payload"] as JsonObject ?? [];
        if (string.IsNullOrWhiteSpace(action)) throw new ApiException("Не указано действие RPC", "ACTION_REQUIRED", 400);

        var result = await api.DispatchAsync(action, payload, context.RequestAborted);
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Success(traceId, action, payload, durationMs, result is JsonObject resultObject && Value.Bool(resultObject, "cached")));
        return Results.Json(new { ok = true, data = result, traceId });
    }
    catch (JsonException error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, "INVALID_JSON", error.Message, 400));
        return Results.Json(new
        {
            ok = false,
            error = "Некорректный JSON в запросе",
            code = "INVALID_JSON",
            status = 400,
            traceId,
            debugUrl = $"/api/debug/requests/{traceId}"
        }, statusCode: 400);
    }
    catch (ApiException error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, error.Code, error.Message, error.Status));
        return Results.Json(new
        {
            ok = false,
            error = error.Message,
            code = error.Code,
            status = error.Status,
            traceId,
            debugUrl = $"/api/debug/requests/{traceId}"
        }, statusCode: error.Status is >= 400 and <= 599 ? error.Status : 500);
    }
    catch (Exception error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, "SERVER_ERROR", error.Message, 500));
        return Results.Json(new
        {
            ok = false,
            error = "Внутренняя ошибка локального сервера",
            code = "SERVER_ERROR",
            status = 500,
            traceId,
            debugUrl = $"/api/debug/requests/{traceId}",
            details = debugEnabled ? error.ToString() : null
        }, statusCode: 500);
    }
});

app.MapGet("/api/debug/status", (ApiRuntime api) => Results.Json(api.DebugStatus()));
app.MapGet("/api/debug/self-test", (ApiRuntime api) => Results.Json(api.SelfTest()));
app.MapGet("/api/debug/cache", (string? projectId, string? clientId, ApiRuntime api) =>
    Results.Json(api.Cache.Describe(projectId, clientId)));
app.MapGet("/api/debug/requests", (int? limit, ApiRuntime api) =>
    Results.Json(api.Traces.List(Math.Clamp(limit ?? 100, 1, 300))));
app.MapGet("/api/debug/requests/{traceId}", (string traceId, ApiRuntime api) =>
    api.Traces.Get(traceId) is { } trace ? Results.Json(trace) : Results.NotFound(new { error = "Запрос не найден" }));
app.MapGet("/api/debug/outbound", (int? limit, ApiRuntime api) =>
    Results.Json(api.OutboundRequests.Snapshot(Math.Clamp(limit ?? 300, 1, 1000))));
app.MapDelete("/api/debug/outbound", async (ApiRuntime api) =>
{
    await api.OutboundRequests.ClearAsync();
    return Results.Json(api.OutboundRequests.Snapshot(1));
});
app.MapPost("/api/debug/cache/check", async (HttpContext context, ApiRuntime api) =>
{
    var payload = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted) as JsonObject ?? [];
    return Results.Json(api.CalculationCacheStatus(payload));
});

app.MapFallbackToFile("index.html");

app.Lifetime.ApplicationStopping.Register(runtime.Dispose);
app.Lifetime.ApplicationStarted.Register(() =>
{
    var url = $"http://127.0.0.1:{port}/";
    Console.WriteLine($"OPS Toolkit Desktop: {url}");
    Console.WriteLine($"Диагностика: {url}api/debug/status");
    if (!args.Contains("--no-open", StringComparer.OrdinalIgnoreCase)) OpenDesktopWindow(url);
});

await app.RunAsync();

static async Task<IResult> ExecuteApiActionAsync(HttpContext context, ApiRuntime api, string action)
{
    var traceId = api.Traces.NextId();
    var started = Stopwatch.GetTimestamp();
    JsonObject payload = [];
    try
    {
        if (context.Request.ContentLength is > 0)
            payload = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted) as JsonObject
                ?? throw new ApiException("Ожидался JSON-объект", "INVALID_REQUEST", 400);
        var result = await api.DispatchAsync(action, payload, context.RequestAborted);
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Success(traceId, action, payload, durationMs, result is JsonObject resultObject && Value.Bool(resultObject, "cached")));
        return Results.Json(new { ok = true, data = result, traceId });
    }
    catch (JsonException error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, "INVALID_JSON", error.Message, 400));
        return Results.Json(new { ok = false, error = "Некорректный JSON в запросе", code = "INVALID_JSON", status = 400, traceId, debugUrl = $"/api/debug/requests/{traceId}" }, statusCode: 400);
    }
    catch (ApiException error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, error.Code, error.Message, error.Status));
        return Results.Json(new { ok = false, error = error.Message, code = error.Code, status = error.Status, traceId, debugUrl = $"/api/debug/requests/{traceId}" }, statusCode: error.Status is >= 400 and <= 599 ? error.Status : 500);
    }
    catch (Exception error)
    {
        var durationMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        api.Traces.Add(RequestTrace.Failure(traceId, action, payload, durationMs, "SERVER_ERROR", error.Message, 500));
        return Results.Json(new { ok = false, error = "Внутренняя ошибка локального сервера", code = "SERVER_ERROR", status = 500, traceId, debugUrl = $"/api/debug/requests/{traceId}" }, statusCode: 500);
    }
}

static int ReadPort()
{
    return int.TryParse(Environment.GetEnvironmentVariable("OPS_TOOLKIT_PORT"), out var port) && port is > 1024 and < 65535
        ? port
        : 48731;
}

static int FindAvailablePort(int preferred)
{
    for (var port = preferred; port < preferred + 20; port++)
    {
        try
        {
            var listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            listener.Stop();
            return port;
        }
        catch (SocketException)
        {
            // Try the next local port.
        }
    }
    throw new InvalidOperationException($"Не найден свободный порт, начиная с {preferred}");
}

static string ResolvePublicPath()
{
    var candidates = new[]
    {
        Environment.GetEnvironmentVariable("OPS_TOOLKIT_PUBLIC"),
        Path.Combine(Directory.GetCurrentDirectory(), "public"),
        Path.Combine(AppContext.BaseDirectory, "public"),
        Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "public"))
    };
    var path = candidates.FirstOrDefault(candidate => !string.IsNullOrWhiteSpace(candidate) && Directory.Exists(candidate));
    return path ?? throw new DirectoryNotFoundException("Не найдена папка public десктопного приложения");
}

static void OpenDesktopWindow(string url)
{
    var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
    var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    var candidates = new[]
    {
        Path.Combine(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
        Path.Combine(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
        Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
        Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
        Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")
    };
    var browser = candidates.FirstOrDefault(File.Exists);
    try
    {
        if (browser is not null)
        {
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "OPS Toolkit Desktop", "browser-profile");
            Directory.CreateDirectory(profile);
            Process.Start(new ProcessStartInfo(browser, $"--app={url} --user-data-dir=\"{profile}\" --no-first-run")
            {
                UseShellExecute = true
            });
            return;
        }
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
    catch (Exception error)
    {
        Console.WriteLine($"Не удалось открыть окно автоматически: {error.Message}");
    }
}

sealed class ApiRuntime : IDisposable
{
    private const string DaDataUrl = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
    private const string DefaultCargoType = "4aab1fc6-fc2b-473a-8728-58bcd4ff79ba";
    private const int MaxCalculationConcurrency = 6;
    private const int MaxCancelConcurrency = 5;
    private static readonly HashSet<int> NonTransportCompanyIds = [2, 6, 17];
    private static readonly string[] NonTransportCompanyPatterns = ["достависта", "пешкар", "яндекс достав"];
    private static readonly string[] DefaultExclusions = ["Достависта", "Пешкарики", "Dimex", "FoxExpress", "Яндекс Доставка", "Global Delivery", "TNT", "UPS"];
    private static readonly int[] DefaultExcludedIds = [2, 6, 12, 14, 17, 19, 16, 15];

    private readonly string _version;
    private readonly bool _debug;
    private readonly HttpClient _http;
    private readonly ConcurrentDictionary<string, Lazy<Task<JsonNode>>> _inFlight = new(StringComparer.Ordinal);
    private readonly RateGate _dadataGate = new(30, TimeSpan.FromSeconds(1));
    private readonly RateGate _lkAddressGate = new(20, TimeSpan.FromSeconds(1));
    private readonly DynamicConcurrencyGate _calculationGate = new(MaxCalculationConcurrency);
    private readonly DynamicConcurrencyGate _orderGate = new(MaxCalculationConcurrency);
    private readonly DynamicConcurrencyGate _cancelGate = new(MaxCancelConcurrency);

    public ServerCache Cache { get; }
    public TraceStore Traces { get; } = new();
    public OutboundRequestStore OutboundRequests { get; }

    public ApiRuntime(string version, bool debug)
    {
        _version = version;
        _debug = debug;
        var handler = new SocketsHttpHandler
        {
            UseCookies = false,
            AllowAutoRedirect = true,
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(12),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(3),
            MaxConnectionsPerServer = 24
        };
        _http = new HttpClient(handler)
        {
            Timeout = Timeout.InfiniteTimeSpan
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("OPS-Toolkit-Desktop/0.2");
        Cache = new ServerCache();
        OutboundRequests = new OutboundRequestStore();
    }

    public object Limits() => new
    {
        dadataPerSecond = 30,
        lkAddressPerSecond = 20,
        calculations = MaxCalculationConcurrency,
        orders = MaxCalculationConcurrency,
        cancels = MaxCancelConcurrency
    };

    public object DebugStatus() => new
    {
        ok = true,
        version = _version,
        mode = "desktop-csharp",
        debug = _debug,
        process = new
        {
            workingSetBytes = Environment.WorkingSet,
            managedBytes = GC.GetTotalMemory(false),
            threads = Process.GetCurrentProcess().Threads.Count
        },
        cache = Cache.Summary(),
        inFlight = _inFlight.Count,
        gates = new
        {
            dadata = _dadataGate.Stats(),
            lkAddress = _lkAddressGate.Stats(),
            calculation = _calculationGate.Stats(),
            orders = _orderGate.Stats(),
            cancellation = _cancelGate.Stats()
        },
        recentErrors = Traces.List(30).Where(trace => !trace.Ok).Take(10)
    };

    public object SelfTest()
    {
        var basePayload = new JsonObject
        {
            ["projectId"] = "kd",
            ["email"] = "self-test@example.local",
            ["userId"] = "client-a",
            ["senderCity"] = "city-a",
            ["recipientCity"] = "city-b",
            ["cargoWeight"] = 2.5,
            ["cargoSeats"] = 1,
            ["cargoLength"] = 30,
            ["cargoWidth"] = 20,
            ["cargoHeight"] = 15
        };
        var anotherClient = (JsonObject)basePayload.DeepClone();
        anotherClient["userId"] = "client-b";
        var presentationVariant = (JsonObject)basePayload.DeepClone();
        presentationVariant["exclusions"] = new JsonArray("CSE");
        presentationVariant["bestExclusions"] = new JsonArray("DPD");
        presentationVariant["bestMethodMode"] = "all";
        var keyA = CalculationCacheKey(basePayload);
        var keyARepeat = CalculationCacheKey((JsonObject)basePayload.DeepClone());
        var keyB = CalculationCacheKey(anotherClient);
        var presentationKey = CalculationCacheKey(presentationVariant);

        var calculatorResponse = new JsonObject
        {
            ["status"] = true,
            ["data"] = new JsonArray
            {
                new JsonObject { ["deliveryCompany"] = 2, ["deliveryCompanyLabel"] = "Достависта", ["tariffCaption"] = "Курьер", ["deliveryMethod"] = 1, ["user_price"] = 100 },
                new JsonObject { ["deliveryCompany"] = 0, ["deliveryCompanyLabel"] = "CSE", ["tariffCaption"] = "Стандарт", ["deliveryMethod"] = 1, ["user_price"] = 200, ["minPeriod"] = 1, ["maxPeriod"] = 3 },
                new JsonObject { ["deliveryCompany"] = 4, ["deliveryCompanyLabel"] = "DPD", ["tariffCaption"] = "Эконом", ["deliveryMethod"] = 1, ["user_price"] = 300 }
            }
        };
        var companies = new JsonArray
        {
            new JsonObject { ["id"] = 2, ["label"] = "Достависта" },
            new JsonObject { ["id"] = 0, ["label"] = "CSE" },
            new JsonObject { ["id"] = 4, ["label"] = "DPD" }
        };
        var processed = ProcessCalculation(Project.Get("kd"), calculatorResponse, ["не исключать тестовые тк"], [], "door", companies);
        var bestCompany = Value.String(processed["best"] as JsonObject ?? [], "deliveryCompanyLabel");
        var filtered = ProcessCalculation(Project.Get("kd"), calculatorResponse, ["не исключать тестовые тк"], ["CSE"], "door", companies);
        var filteredBestCompany = Value.String(filtered["best"] as JsonObject ?? [], "deliveryCompanyLabel");
        var cse = (processed["allTariffs"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(item => Value.String(item, "deliveryCompanyLabel") == "CSE") ?? [];
        var sanitizedUrl = RequestLogSanitizer.Url("https://example.local/api?authToken=secret&cargo_weight=2.5&sender_address=Москва");
        var sanitizedBody = RequestLogSanitizer.Body("""{"password":"secret","cargoWeight":2.5,"sender":{"phone":"79990000000"}}""");
        var checks = new
        {
            deterministicKey = keyA == keyARepeat,
            clientsSeparated = keyA != keyB,
            presentationFiltersReuseNetworkCache = keyA == presentationKey,
            transportOnlyBest = bestCompany == "CSE",
            bestFilterApplied = filteredBestCompany == "DPD",
            periodRangePreserved = Value.Double(cse, "minPeriod") == 1 && Value.Double(cse, "maxPeriod") == 3,
            outboundSecretsMasked = !sanitizedUrl.Contains("secret", StringComparison.Ordinal)
                && !sanitizedUrl.Contains("Москва", StringComparison.Ordinal)
                && sanitizedUrl.Contains("cargo_weight=2.5", StringComparison.Ordinal)
                && !sanitizedBody.Contains("secret", StringComparison.Ordinal)
                && !sanitizedBody.Contains("79990000000", StringComparison.Ordinal)
        };
        return new
        {
            ok = checks.deterministicKey && checks.clientsSeparated && checks.presentationFiltersReuseNetworkCache && checks.transportOnlyBest
                && checks.bestFilterApplied && checks.periodRangePreserved && checks.outboundSecretsMasked,
            checks,
            bestCompany,
            filteredBestCompany,
            cacheKeyA = ShortHash(keyA),
            cacheKeyB = ShortHash(keyB)
        };
    }

    public async Task<JsonNode> DispatchAsync(string action, JsonObject payload, CancellationToken cancellationToken)
    {
        return action switch
        {
            "ping" => Ping(),
            "auth" => new JsonObject { ["token"] = await GetAuthTokenAsync(payload, Value.Bool(payload, "force"), cancellationToken) },
            "deliveryCompanies" => await DeliveryCompaniesAsync(payload, cancellationToken),
            "searchUser" => await SearchUserAsync(payload, cancellationToken),
            "resolveAddress" => await ResolveAddressAsync(payload, cancellationToken),
            "calculate" => await CalculateAsync(payload, cancellationToken),
            "createOrder" => await CreateOrderAsync(payload, cancellationToken),
            "cancelOrder" => await CancelOrderAsync(payload, cancellationToken),
            "cacheStats" => JsonSerializer.SerializeToNode(Cache.Stats())!,
            "clearCache" => ClearCache(payload),
            "calculationCacheStatus" => JsonSerializer.SerializeToNode(CalculationCacheStatus(payload))!,
            "debugStatus" => JsonSerializer.SerializeToNode(DebugStatus())!,
            _ => throw new ApiException($"Неизвестное действие: {action}", "UNKNOWN_ACTION", 400)
        };
    }

    public object CalculationCacheStatus(JsonObject payload)
    {
        var key = CalculationCacheKey(payload);
        var hit = Cache.TryGet(key, out _, out var metadata);
        return new
        {
            hit,
            context = new
            {
                projectId = Value.String(payload, "projectId", "kd"),
                clientId = Value.String(payload, "userId"),
                senderCity = Value.String(payload, "senderCity"),
                recipientCity = Value.String(payload, "recipientCity"),
                cargo = CargoSignature(payload)
            },
            cacheKeyHash = ShortHash(key),
            createdAt = metadata?.CreatedAt,
            expiresAt = metadata?.ExpiresAt
        };
    }

    public JsonObject Info() => Ping();

    private JsonObject Ping()
    {
        var projects = new JsonArray(Project.All.Select(project => (JsonNode)new JsonObject
        {
            ["id"] = project.Id,
            ["label"] = project.Label,
            ["shortLabel"] = project.ShortLabel
        }).ToArray());
        return new JsonObject
        {
            ["mode"] = "desktop-csharp",
            ["version"] = _version,
            ["server"] = true,
            ["projects"] = projects
        };
    }

    private JsonObject ClearCache(JsonObject payload)
    {
        var category = Value.String(payload, "category", "all");
        var projectId = Value.String(payload, "projectId");
        Cache.Clear(category, projectId);
        if (category == "all") _inFlight.Clear();
        return new JsonObject
        {
            ["cleared"] = true,
            ["stats"] = JsonSerializer.SerializeToNode(Cache.Stats())
        };
    }

    private async Task<string> GetAuthTokenAsync(JsonObject payload, bool force, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var email = Value.String(payload, "email").Trim();
        var password = Value.String(payload, "password");
        if (email.Length == 0 || password.Length == 0)
            throw new ApiException($"Укажите email и пароль проекта «{project.Label}»", "AUTH_REQUIRED", 400);

        var key = $"auth:{project.Id}:{AccountScope(project.Id, email)}";
        if (!force && Cache.TryGet(key, out var cached, out _)) return cached!.GetValue<string>();

        var result = await CoalesceAsync(key, async () =>
        {
            var url = BuildUrl(project.BaseUrl + "/api/auth/getToken", new Dictionary<string, string>
            {
                ["email"] = email,
                ["password"] = password
            });
            var json = await FetchJsonAsync(HttpMethod.Get, url, null, null, 30_000, 1, null, null, 0, cancellationToken);
            var token = Value.String(json, "authToken");
            if (!Value.Bool(json, "status") || token.Length == 0)
                throw new ApiException("Ошибка авторизации. Проверьте логин и пароль.", "AUTH_FAILED", 401);
            var node = JsonValue.Create(token)!;
            Cache.Set(key, node, TimeSpan.FromMinutes(38), "auth", project.Id, null, persist: false);
            return node;
        });
        return result.GetValue<string>();
    }

    private async Task<JsonNode> DeliveryCompaniesAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var token = await GetAuthTokenAsync(payload, Value.Bool(payload, "force"), cancellationToken);
        var companies = await GetDeliveryCompaniesAsync(project, token, AccountScope(project.Id, Value.String(payload, "email")), Value.Bool(payload, "force"), cancellationToken);
        return new JsonObject { ["projectId"] = project.Id, ["companies"] = companies.DeepClone() };
    }

    private async Task<JsonArray> GetDeliveryCompaniesAsync(Project project, string authToken, string accountScope, bool force, CancellationToken cancellationToken)
    {
        var key = $"companies:{project.Id}:{accountScope}";
        if (force) Cache.Remove(key);
        if (!force && Cache.TryGet(key, out var cached, out _)) return (JsonArray)cached!.DeepClone();

        var result = await CoalesceAsync(key, async () =>
        {
            var url = BuildUrl(project.BaseUrl + "/api/cse/referenceDeliveryCompany", new Dictionary<string, string> { ["authToken"] = authToken });
            var json = await FetchJsonAsync(HttpMethod.Get, url, null, null, 30_000, 1, null, null, 0, cancellationToken);
            var companies = NormalizeCompanies(json);
            if (!Value.Bool(json, "status") || companies.Count == 0)
                throw new ApiException("Не удалось получить список ТК партнёра", "DELIVERY_COMPANIES_EMPTY", 502);
            Cache.Set(key, companies, TimeSpan.FromHours(6), "companies", project.Id, null);
            return companies;
        });
        return (JsonArray)result.DeepClone();
    }

    private static JsonArray NormalizeCompanies(JsonObject json)
    {
        var list = new List<(int Id, string Label)>();
        if (json["labels"] is JsonObject labels)
        {
            foreach (var (key, value) in labels)
            {
                var label = value?.ToString().Trim() ?? "";
                if (label.Length == 0) continue;
                list.Add((int.TryParse(key, out var id) ? id : int.MaxValue, label));
            }
        }
        return new JsonArray(list.OrderBy(item => item.Id).ThenBy(item => item.Label, StringComparer.CurrentCultureIgnoreCase)
            .Select(item => (JsonNode)new JsonObject { ["id"] = item.Id == int.MaxValue ? null : item.Id, ["label"] = item.Label }).ToArray());
    }

    private async Task<JsonNode> SearchUserAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var email = Value.String(payload, "email").Trim();
        var inn = Value.String(payload, "inn").Trim();
        if (inn.Length == 0) throw new ApiException("Введите ИНН контрагента", "INN_REQUIRED", 400);
        var authToken = await GetAuthTokenAsync(payload, false, cancellationToken);
        var accountScope = AccountScope(project.Id, email);
        var key = $"user:{project.Id}:{accountScope}:{Normalize(inn)}";
        if (Cache.TryGet(key, out var cached, out _)) return cached!.DeepClone();

        return await CoalesceAsync(key, async () =>
        {
            var url = BuildUrl(project.BaseUrl + "/api/user/list", new Dictionary<string, string>
            {
                ["authToken"] = authToken,
                ["attributes[inn]"] = inn
            });
            var json = await FetchJsonAsync(HttpMethod.Get, url, null, null, 25_000, 2, null, null, 0, cancellationToken);
            var item = (json["items"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault();
            if (!Value.Bool(json, "status") || item is null)
                throw new ApiException($"Пользователь с ИНН {inn} не найден.", "USER_NOT_FOUND", 404);
            var result = new JsonObject
            {
                ["id"] = Value.Node(item, "id"),
                ["display"] = Value.String(item, "display", "Без имени"),
                ["inn"] = inn,
                ["projectId"] = project.Id
            };
            Cache.Set(key, result, TimeSpan.FromHours(1), "users", project.Id, Value.String(item, "id"));
            return result;
        });
    }

    private async Task<JsonNode> ResolveAddressAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var query = Value.String(payload, "query").Trim();
        var token = Value.String(payload, "tokenDaData").Trim();
        if (query.Length < 3) throw new ApiException("Введите минимум 3 символа адреса", "ADDRESS_TOO_SHORT", 400);
        if (token.Length == 0) throw new ApiException("Не указан токен DaData", "DADATA_REQUIRED", 400);

        var finalKey = $"address:{project.Id}:{Normalize(query)}";
        if (Cache.TryGet(finalKey, out var finalCached, out _))
        {
            var hit = (JsonObject)finalCached!.DeepClone();
            hit["cached"] = true;
            hit["cacheSource"] = "dadata";
            return hit;
        }

        var dadataKey = $"dadata:{Normalize(query)}";
        JsonObject suggestion;
        if (Cache.TryGet(dadataKey, out var dadataCached, out _)) suggestion = (JsonObject)dadataCached!.DeepClone();
        else
        {
            suggestion = (JsonObject)await CoalesceAsync(dadataKey, async () =>
            {
                var body = JsonSerializer.Serialize(new
                {
                    from_bound = new { value = "city" },
                    to_bound = new { value = "house" },
                    count = 1,
                    query
                });
                var dadata = await FetchJsonAsync(HttpMethod.Post, DaDataUrl, body,
                    new Dictionary<string, string> { ["Authorization"] = $"Token {token}" }, 25_000, 2,
                    _dadataGate, null, 0, cancellationToken);
                var first = (dadata["suggestions"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault();
                if (first is null) throw new ApiException($"Адрес «{query}» не найден", "ADDRESS_NOT_FOUND", 404);
                var data = first["data"] as JsonObject ?? [];
                var fiasId = Value.String(data, "settlement_fias_id");
                if (fiasId.Length == 0) fiasId = Value.String(data, "city_fias_id");
                if (fiasId.Length == 0) throw new ApiException("DaData не вернула FIAS ID города/населённого пункта", "FIAS_NOT_FOUND", 422);
                var compact = new JsonObject
                {
                    ["unrestrictedValue"] = Value.String(first, "unrestricted_value", Value.String(first, "value", query)),
                    ["suggestionValue"] = Value.String(first, "value", query),
                    ["fiasId"] = fiasId
                };
                Cache.Set(dadataKey, compact, TimeSpan.FromDays(7), "dadata", "", null);
                return compact;
            });
        }

        var geoKey = $"geo:{project.Id}:{Value.String(suggestion, "fiasId")}";
        JsonObject geo;
        if (Cache.TryGet(geoKey, out var geoCached, out _)) geo = (JsonObject)geoCached!.DeepClone();
        else
        {
            geo = (JsonObject)await CoalesceAsync(geoKey, async () =>
            {
                var url = BuildUrl(project.BaseUrl + "/ajax/autocompleteCseGeoObject", new Dictionary<string, string>
                {
                    ["fias_id"] = Value.String(suggestion, "fiasId")
                });
                var json = await FetchJsonAsync(HttpMethod.Get, url, null, null, 25_000, 2, _lkAddressGate, null, 0, cancellationToken);
                var item = (json["items"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault();
                if (item is null || Value.String(item, "id").Length == 0)
                    throw new ApiException($"Город не найден в справочнике «{project.Label}»", "PROJECT_GEO_NOT_FOUND", 404);
                var placeText = string.Join(", ", new[] { Value.String(item, "text"), Value.String(item, "area"), Value.String(item, "region") }.Where(value => value.Length > 0));
                var compact = new JsonObject
                {
                    ["placeId"] = Value.Node(item, "id"),
                    ["placeText"] = placeText.Length > 0 ? placeText : Value.String(suggestion, "suggestionValue")
                };
                Cache.Set(geoKey, compact, TimeSpan.FromDays(7), "geo", project.Id, null);
                return compact;
            });
        }

        var result = new JsonObject
        {
            ["query"] = query,
            ["projectId"] = project.Id,
            ["unrestrictedValue"] = Value.String(suggestion, "unrestrictedValue"),
            ["fiasId"] = Value.String(suggestion, "fiasId"),
            ["placeId"] = Value.Node(geo, "placeId"),
            ["placeText"] = Value.String(geo, "placeText"),
            ["kdId"] = Value.Node(geo, "placeId"),
            ["kdText"] = Value.String(geo, "placeText")
        };
        Cache.Set(finalKey, result, TimeSpan.FromDays(7), "addresses", project.Id, null);
        return result;
    }

    private async Task<JsonNode> CalculateAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var userId = Value.String(payload, "userId").Trim();
        var senderCity = Value.String(payload, "senderCity").Trim();
        var recipientCity = Value.String(payload, "recipientCity").Trim();
        if (userId.Length == 0) throw new ApiException("Не выбран контрагент", "USER_REQUIRED", 400);
        if (senderCity.Length == 0 || recipientCity.Length == 0) throw new ApiException("Не удалось определить оба города", "CITY_REQUIRED", 400);

        var key = CalculationCacheKey(payload);
        var force = Value.Bool(payload, "force");
        if (force) Cache.Remove(key);
        JsonNode? cached = null;
        var cacheHit = !force && Cache.TryGet(key, out cached, out _);
        var bundle = cacheHit
            ? (JsonObject)cached!.DeepClone()
            : (JsonObject)await CoalesceAsync(key, async () =>
        {
            // The LK response is cached before UI filters are applied. Changing exclusions or
            // the best-tariff rule therefore never causes another remote calculation.
            if (!force && Cache.TryGet(key, out var coalesced, out _)) return coalesced!;
            var authToken = await GetAuthTokenAsync(payload, false, cancellationToken);
            JsonArray partnerCompanies;
            try
            {
                partnerCompanies = await GetDeliveryCompaniesAsync(project, authToken,
                    AccountScope(project.Id, Value.String(payload, "email")), false, cancellationToken);
            }
            catch
            {
                partnerCompanies = FallbackCompanies(project);
            }
            var attributes = new Dictionary<string, string>
            {
                ["attributes[sender_city]"] = senderCity,
                ["attributes[recipient_city]"] = recipientCity,
                ["attributes[cargo_type]"] = Value.String(payload, "cargoType", DefaultCargoType),
                ["attributes[cargo_seats_number]"] = CargoSeats(payload).ToString(CultureInfo.InvariantCulture),
                ["attributes[cargo_weight]"] = CargoNumber(payload, "cargoWeight", 0.1).ToString(CultureInfo.InvariantCulture),
                ["attributes[cargo_length]"] = CargoNumber(payload, "cargoLength", 10).ToString(CultureInfo.InvariantCulture),
                ["attributes[cargo_width]"] = CargoNumber(payload, "cargoWidth", 10).ToString(CultureInfo.InvariantCulture),
                ["attributes[cargo_height]"] = CargoNumber(payload, "cargoHeight", 10).ToString(CultureInfo.InvariantCulture),
                ["attributes[user_id]"] = userId,
                ["attributes[deliveryCompany]"] = "0",
                ["authToken"] = authToken
            };
            var url = BuildUrl(project.BaseUrl + "/api/cse/calc", attributes);
            var timeout = Math.Clamp(Value.Int(payload, "timeoutMs", 90_000), 30_000, 180_000);
            var retries = Math.Clamp(Value.Int(payload, "retries", 2), 0, 3);
            var max = Math.Clamp(Value.Int(payload, "maxConcurrentCalculations", MaxCalculationConcurrency), 1, MaxCalculationConcurrency);
            var remote = await FetchJsonAsync(HttpMethod.Get, url, null, null, timeout, retries, null, _calculationGate, max, cancellationToken);
            if (!Value.Bool(remote, "status") || remote["data"] is not JsonArray remoteTariffs || remoteTariffs.Count == 0)
                throw new ApiException("Нет доступных тарифов", "NO_TARIFFS", 404);
            var cachedBundle = new JsonObject
            {
                ["response"] = remote.DeepClone(),
                ["companies"] = partnerCompanies.DeepClone()
            };
            Cache.Set(key, cachedBundle, TimeSpan.FromDays(2), "calculations", project.Id, userId);
            return cachedBundle;
        });

        var response = bundle["response"] as JsonObject
            ?? throw new ApiException("Повреждён кеш расчёта", "CALCULATION_CACHE_INVALID", 500);
        var partnerCompanies = bundle["companies"] as JsonArray ?? FallbackCompanies(project);

        var processed = ProcessCalculation(project, response, StringArray(payload, "exclusions"), StringArray(payload, "bestExclusions"), Value.String(payload, "bestMethodMode"), partnerCompanies);
        var result = Value.Bool(payload, "orderCreatorCompact") ? CompactOrderCreatorResult(processed) : processed;
        result["cached"] = cacheHit;
        if (cacheHit) result["cacheSource"] = "calculator";
        result["calculationContext"] = CalculationContext(payload, key);
        return result;
    }

    private JsonObject CalculationContext(JsonObject payload, string key) => new()
    {
        ["projectId"] = Value.String(payload, "projectId", "kd"),
        ["clientId"] = Value.String(payload, "userId"),
        ["accountScope"] = AccountScope(Value.String(payload, "projectId", "kd"), Value.String(payload, "email")),
        ["signature"] = ShortHash(key)
    };

    private string CalculationCacheKey(JsonObject payload)
    {
        var projectId = Value.String(payload, "projectId", "kd");
        var userId = Value.String(payload, "userId");
        return string.Join("|", new[]
        {
            "calc:raw:v16", projectId, AccountScope(projectId, Value.String(payload, "email")), userId,
            Normalize(Value.String(payload, "senderCity")), Normalize(Value.String(payload, "recipientCity")),
            Value.String(payload, "cargoType", DefaultCargoType), CargoSeats(payload).ToString(CultureInfo.InvariantCulture),
            CargoNumber(payload, "cargoWeight", 0.1).ToString("0.###", CultureInfo.InvariantCulture),
            CargoNumber(payload, "cargoLength", 10).ToString("0.###", CultureInfo.InvariantCulture),
            CargoNumber(payload, "cargoWidth", 10).ToString("0.###", CultureInfo.InvariantCulture),
            CargoNumber(payload, "cargoHeight", 10).ToString("0.###", CultureInfo.InvariantCulture)
        });
    }

    private static string CargoSignature(JsonObject payload) => string.Join(" × ", new[]
    {
        $"{CargoNumber(payload, "cargoWeight", 0.1):0.###} кг / {CargoSeats(payload)} м.",
        $"{CargoNumber(payload, "cargoLength", 10):0.###}×{CargoNumber(payload, "cargoWidth", 10):0.###}×{CargoNumber(payload, "cargoHeight", 10):0.###}"
    });

    private static int CargoSeats(JsonObject payload) => Math.Max(1, (int)Math.Round(CargoNumber(payload, "cargoSeats", 1)));
    private static double CargoNumber(JsonObject payload, string key, double fallback)
    {
        var value = Value.Double(payload, key, fallback);
        return value > 0 ? value : fallback;
    }

    private JsonObject ProcessCalculation(Project project, JsonObject response, string[] exclusions, string[] bestExclusions, string bestMethodMode, JsonArray partnerCompanies)
    {
        if (!Value.Bool(response, "status") || response["data"] is not JsonArray source || source.Count == 0)
            throw new ApiException("Нет доступных тарифов", "NO_TARIFFS", 404);

        var companyById = new Dictionary<int, string>();
        var companyByName = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var company in partnerCompanies.OfType<JsonObject>())
        {
            var label = Value.String(company, "label").Trim();
            var id = Value.Int(company, "id", int.MinValue);
            if (label.Length == 0) continue;
            if (id != int.MinValue) companyById[id] = label;
            companyByName[Normalize(label)] = id;
        }

        var configuredExclusions = exclusions.Length > 0 ? exclusions : project.DefaultExclusions;
        var excludedNames = configuredExclusions.Select(Normalize).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var excludedIds = exclusions.Length > 0 ? new HashSet<int>() : project.DefaultExcludedIds.ToHashSet();
        foreach (var name in configuredExclusions)
            if (companyByName.TryGetValue(Normalize(name), out var id)) excludedIds.Add(id);

        var tariffs = source.OfType<JsonObject>()
            .Select((item, index) => CompactTariff(item, index, companyById))
            .Where(item => !excludedNames.Contains(Normalize(Value.String(item, "deliveryCompanyLabel")))
                && !excludedIds.Contains(Value.Int(item, "deliveryCompany", int.MinValue)))
            .ToList();
        if (project.SortStrategy == "urgency") tariffs = SortByUrgency(tariffs);

        var mode = bestMethodMode.Length > 0 ? bestMethodMode : project.DefaultBestMethod;
        var selection = mode == "all" ? tariffs : tariffs.Where(item => Value.Int(item, "deliveryMethod", -1) == 1).ToList();
        if (selection.Count == 0)
            throw new ApiException(mode == "all" ? "Нет доступных тарифов" : "Нет тарифов с методом дверь-дверь", "NO_SELECTED_TARIFFS", 404);

        // Курьерские агрегаторы остаются в полном списке, но не могут стать самым дешёвым транспортным тарифом.
        var bestExcludedNames = bestExclusions.Select(Normalize).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var bestExcludedIds = bestExclusions.Select(name => companyByName.TryGetValue(Normalize(name), out var id) ? id : int.MinValue).Where(id => id != int.MinValue).ToHashSet();
        var transport = selection.Where(item => IsTransportBestCandidate(item)
            && !bestExcludedNames.Contains(Normalize(Value.String(item, "deliveryCompanyLabel")))
            && !bestExcludedIds.Contains(Value.Int(item, "deliveryCompany", int.MinValue))).ToList();
        var cheapest = transport.Where(IsValidTariff).OrderBy(item => Value.Double(item, "userPrice", 0)).FirstOrDefault();

        var companies = new JsonObject();
        foreach (var group in selection.Where(IsValidTariff).GroupBy(item => Value.String(item, "deliveryCompanyLabel", "Неизвестная ТК")))
            companies[group.Key] = group.OrderBy(item => Value.Double(item, "userPrice", double.MaxValue)).First().DeepClone();

        var referenceOrder = partnerCompanies.OfType<JsonObject>().Select(item => Value.String(item, "label")).Where(value => value.Length > 0).ToList();
        var preferred = referenceOrder.Count > 0 ? referenceOrder : project.TargetOrder.ToList();
        var targetOrder = preferred.Where(name => companies.ContainsKey(name))
            .Concat(companies.Select(pair => pair.Key).Where(name => !preferred.Contains(name, StringComparer.OrdinalIgnoreCase)))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        return new JsonObject
        {
            ["projectId"] = project.Id,
            ["projectLabel"] = project.Label,
            ["sortStrategy"] = project.SortStrategy,
            ["best"] = cheapest?.DeepClone() ?? new JsonObject
            {
                ["deliveryCompanyLabel"] = "Нет транспортных тарифов",
                ["tariffCaption"] = "Нет подходящего транспортного варианта",
                ["userPrice"] = 0,
                ["deliveryMethodLabel"] = "—",
                ["deliveryTypeLabel"] = "—"
            },
            ["companies"] = companies,
            ["targetOrder"] = new JsonArray(targetOrder.Select(value => (JsonNode?)JsonValue.Create(value)).ToArray()),
            ["allTariffs"] = new JsonArray(selection.Select(item => item.DeepClone()).ToArray()),
            ["bestMethodMode"] = mode,
            ["calculatedAt"] = DateTimeOffset.UtcNow.ToString("O")
        };
    }

    private static bool IsValidTariff(JsonObject item) => Value.Double(item, "userPrice", 0) > 0 && !Value.Bool(item, "hasError");
    private static bool IsTransportBestCandidate(JsonObject item)
    {
        var id = Value.Int(item, "deliveryCompany", int.MinValue);
        var name = Normalize(Value.String(item, "deliveryCompanyLabel"));
        return !NonTransportCompanyIds.Contains(id) && !NonTransportCompanyPatterns.Any(name.Contains);
    }

    private static List<JsonObject> SortByUrgency(IEnumerable<JsonObject> tariffs)
    {
        return tariffs.OrderBy(item => UrgencyRank(Value.String(item, "urgencyLabel")))
            .ThenBy(item => Value.String(item, "urgencyLabel"), StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(item => Value.Double(item, "maxPeriod", double.MaxValue))
            .ThenBy(item => Value.Double(item, "userPrice", double.MaxValue))
            .Select((item, index) =>
            {
                item["calculatorOrder"] = index;
                return item;
            }).ToList();
    }

    private static int UrgencyRank(string label)
    {
        var value = Normalize(label);
        if (value.Contains("сверхсроч") || value.Contains("super")) return 0;
        if (value.Contains("сроч")) return 10;
        if (value.Contains("экспресс") || value.Contains("express")) return 20;
        if (value.Contains("стандарт")) return 30;
        if (value.Contains("эконом")) return 40;
        if (value.Contains("автомоб")) return 50;
        return 60;
    }

    private static JsonObject CompactTariff(JsonObject item, int order, IReadOnlyDictionary<int, string> companyById)
    {
        var deliveryCompany = Value.Int(item, "deliveryCompany", int.MinValue);
        var label = companyById.TryGetValue(deliveryCompany, out var reference)
            ? reference
            : Value.String(item, "deliveryCompanyLabel");
        var retailPrice = Number(item, "retailPrice", "retail_price");
        var userPrice = Number(item, "user_price", "userPrice") ?? 0;
        var returnService = item["return_service"] as JsonObject ?? [];
        var services = item["services"] is JsonArray serviceItems
            ? new JsonArray(serviceItems.OfType<JsonObject>().Select(service => (JsonNode)CompactService(service)).ToArray())
            : [];
        return new JsonObject
        {
            ["calculatorOrder"] = order,
            ["tariffId"] = Value.String(item, "tariffId"),
            ["deliveryCompany"] = deliveryCompany == int.MinValue ? Value.Node(item, "deliveryCompany") : deliveryCompany,
            ["tariffName"] = Value.String(item, "tariffName"),
            ["urgencyId"] = Value.String(item, "urgencyId"),
            ["urgencyLabel"] = Value.String(item, "urgencyIdLabel"),
            ["activeDiscount"] = Number(item, "activeDiscount"),
            ["tariffCaption"] = First(Value.String(item, "tariffCaption"), Value.String(item, "urgencyIdLabel"), Value.String(item, "tariffName")),
            ["tariffDescription"] = Value.String(item, "tariffDescription"),
            ["deliveryCompanyLabel"] = label.Trim(),
            ["deliveryCompanyIcon"] = Value.String(item, "deliveryCompanyIcon"),
            ["deliveryMethod"] = Value.Node(item, "deliveryMethod"),
            ["deliveryMethodLabel"] = DeliveryMethodLabel(item),
            ["deliveryType"] = Value.Node(item, "deliveryType"),
            ["deliveryTypeLabel"] = First(Value.String(item, "deliveryTypeLabel"), DeliveryMethodLabel(item)),
            ["hasError"] = Value.Bool(item, "hasError"),
            ["minPeriod"] = Number(item, "minPeriod", "periodMin", "min_period", "deliveryPeriodMin", "delivery_period_min"),
            ["maxPeriod"] = Number(item, "maxPeriod", "periodMax", "max_period", "deliveryPeriodMax", "delivery_period_max"),
            ["userPrice"] = userPrice,
            ["userPriceWithoutDiscount"] = Number(item, "user_price_without_discount"),
            ["inputPrice"] = Number(item, "input_price", "inputPrice"),
            ["inputPricePercent"] = Number(item, "inputPricePercent"),
            ["retailPrice"] = retailPrice,
            ["minPrice"] = Number(item, "minPrice"),
            ["minPricePercent"] = Number(item, "minPricePercent"),
            ["ratePrice"] = Number(item, "ratePrice"),
            ["ratePricePercent"] = Number(item, "ratePricePercent"),
            ["rateName"] = Value.String(item, "rateName"),
            ["rateId"] = Value.String(item, "rateId"),
            ["basePrice"] = Number(item, "basePrice"),
            ["basePricePercent"] = Number(item, "basePricePercent"),
            ["periodSort"] = Number(item, "periodSort"),
            ["emptyTermText"] = Value.String(item, "emptyTermText"),
            ["forceEmptyTermText"] = Value.Bool(item, "forceEmptyTermText"),
            ["filteredReason"] = Value.String(item, "filteredReason"),
            ["sort"] = Number(item, "sort"),
            ["isAgent"] = Value.Bool(item, "isAgent"),
            ["priority"] = Value.Node(item, "priority"),
            ["servicesPrice"] = Number(item, "servicesPrice"),
            ["discountPercent"] = Number(item, "discountPercent"),
            ["discount"] = Discount(userPrice, retailPrice),
            ["returnServiceAllowed"] = Value.Bool(returnService, "allowed"),
            ["returnServicePrice"] = Number(returnService, "price"),
            ["services"] = services
        };
    }

    private static JsonObject CompactService(JsonObject service)
    {
        var parameters = new JsonArray();
        if (service["params"] is JsonArray sourceParams)
        {
            foreach (var parameter in sourceParams.OfType<JsonObject>())
            {
                var key = First(Value.String(parameter, "key"), Value.String(parameter, "name"), Value.String(parameter, "code"));
                if (key.Length == 0) continue;
                parameters.Add(new JsonObject
                {
                    ["key"] = key,
                    ["caption"] = First(Value.String(parameter, "caption"), Value.String(parameter, "title"), Value.String(parameter, "label"), key),
                    ["type"] = First(Value.String(parameter, "type"), Value.String(parameter, "valueType")),
                    ["valueType"] = First(Value.String(parameter, "valueType"), Value.String(parameter, "type")),
                    ["value"] = Value.FirstNode(parameter, "value", "defaultValue"),
                    ["defaultValue"] = Value.FirstNode(parameter, "defaultValue", "value"),
                    ["required"] = Value.Bool(parameter, "required"),
                    ["rules"] = CloneCollection(parameter["rules"]),
                    ["options"] = CloneCollection(parameter["options"]),
                    ["values"] = CloneCollection(parameter["values"])
                });
            }
        }
        return new JsonObject
        {
            ["key"] = First(Value.String(service, "key"), Value.String(service, "name"), Value.String(service, "code"), Value.String(service, "id")),
            ["enabled"] = Value.Bool(service, "enabled"),
            ["required"] = Value.Bool(service, "required"),
            ["caption"] = First(Value.String(service, "caption"), Value.String(service, "title"), Value.String(service, "key")),
            ["description"] = Value.String(service, "description"),
            ["price"] = Value.Node(service, "price"),
            ["individualPrice"] = Value.Bool(service, "individualPrice"),
            ["params"] = parameters,
            ["incompatibleServices"] = CloneCollection(service["incompatibleServices"])
        };
    }

    private static JsonObject CompactOrderCreatorResult(JsonObject source)
    {
        var tariffs = (source["allTariffs"] as JsonArray)?.OfType<JsonObject>()
            .Where(item => Value.Int(item, "deliveryMethod", -1) == 1 && IsValidTariff(item))
            .Select((item, index) =>
            {
                var compact = (JsonObject)item.DeepClone();
                compact["calculatorOrder"] = index;
                compact.Remove("inputPrice");
                compact.Remove("retailPrice");
                compact.Remove("companies");
                return (JsonNode)compact;
            }).ToArray() ?? [];
        return new JsonObject
        {
            ["projectId"] = Value.String(source, "projectId"),
            ["projectLabel"] = Value.String(source, "projectLabel"),
            ["sortStrategy"] = Value.String(source, "sortStrategy"),
            ["bestMethodMode"] = Value.String(source, "bestMethodMode", "door"),
            ["calculatedAt"] = Value.String(source, "calculatedAt", DateTimeOffset.UtcNow.ToString("O")),
            ["allTariffs"] = new JsonArray(tariffs)
        };
    }

    private async Task<JsonNode> CreateOrderAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var attributes = payload["attributes"] as JsonObject ?? [];
        if (Value.String(payload, "email").Length == 0 || Value.String(payload, "password").Length == 0)
            throw new ApiException("Не заполнены логин и пароль проекта", "AUTH_REQUIRED", 400);
        if (Value.String(attributes, "user_id").Length == 0) throw new ApiException("Не выбран контрагент", "USER_REQUIRED", 400);
        if (Value.String(attributes, "sender_city").Length == 0 || Value.String(attributes, "recipient_city").Length == 0)
            throw new ApiException("Не распознаны города отправителя и получателя", "CITY_REQUIRED", 400);

        var token = await GetAuthTokenAsync(payload, false, cancellationToken);
        var query = new Dictionary<string, string> { ["authToken"] = token };
        foreach (var (key, value) in attributes)
            if (value is not null && value.ToString().Length > 0) query[$"attributes[{key}]"] = value.ToString();
        var max = Math.Clamp(Value.Int(payload, "maxConcurrentOrders", 3), 1, MaxCalculationConcurrency);
        var response = await FetchJsonAsync(HttpMethod.Get, BuildUrl(project.BaseUrl + "/api/cse/add", query), null, null,
            90_000, 1, null, _orderGate, max, cancellationToken);
        var id = FindOrderId(response);
        if (id.Length == 0 && (Value.False(response, "status") || Value.False(response, "success") || HasApiErrors(response)))
            throw new ApiException(ApiErrorMessage(response, "ЛК вернул ошибку создания заказа"), "ORDER_CREATE_FAILED", 422);
        var result = (JsonObject)response.DeepClone();
        result["id"] = id.Length > 0 ? id : null;
        result["raw"] = response.DeepClone();
        return result;
    }

    private async Task<JsonNode> CancelOrderAsync(JsonObject payload, CancellationToken cancellationToken)
    {
        var project = Project.Get(Value.String(payload, "projectId", "kd"));
        var id = Value.String(payload, "id").Trim();
        if (Value.String(payload, "email").Length == 0 || Value.String(payload, "password").Length == 0)
            throw new ApiException("Не заполнены логин и пароль проекта", "AUTH_REQUIRED", 400);
        if (id.Length == 0) throw new ApiException("Не указан ID заказа для отмены", "ORDER_ID_REQUIRED", 400);
        var token = await GetAuthTokenAsync(payload, false, cancellationToken);
        var max = Math.Clamp(Value.Int(payload, "maxConcurrentCancels", MaxCancelConcurrency), 1, MaxCancelConcurrency);
        var response = await FetchJsonAsync(HttpMethod.Get, BuildUrl(project.BaseUrl + "/api/cse/cancel", new Dictionary<string, string>
        {
            ["authToken"] = token,
            ["id"] = id
        }), null, null, 90_000, 1, null, _cancelGate, max, cancellationToken);
        if (Value.False(response, "status") || Value.False(response, "success") || HasApiErrors(response))
            throw new ApiException(ApiErrorMessage(response, "ЛК вернул ошибку отмены заказа"), "ORDER_CANCEL_FAILED", 422);
        var result = (JsonObject)response.DeepClone();
        result["id"] = id;
        result["message"] = First(Value.String(response, "message"), Value.String(response["data"] as JsonObject ?? [], "message"), "Заказ отменён");
        result["raw"] = response.DeepClone();
        return result;
    }

    private async Task<JsonObject> FetchJsonAsync(HttpMethod method, string url, string? body, IReadOnlyDictionary<string, string>? headers,
        int timeoutMs, int retries, RateGate? rateGate, DynamicConcurrencyGate? concurrencyGate, int maxConcurrent,
        CancellationToken cancellationToken)
    {
        Exception? lastError = null;
        for (var attempt = 0; attempt <= retries; attempt++)
        {
            var requestStarted = 0L;
            var requestSent = false;
            int? responseStatus = null;
            var responseBytes = 0;
            var outcome = "network-error";
            var logError = "";
            TimeSpan? responseRetryDelay = null;
            try
            {
                if (rateGate is not null) await rateGate.WaitAsync(cancellationToken);
                await using var lease = concurrencyGate is null
                    ? AsyncLease.Empty
                    : await concurrencyGate.AcquireAsync(maxConcurrent, cancellationToken);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(timeoutMs);
                using var request = new HttpRequestMessage(method, url);
                request.Headers.Accept.ParseAdd("application/json, text/plain, */*");
                if (headers is not null)
                {
                    foreach (var (name, value) in headers)
                        request.Headers.TryAddWithoutValidation(name, value);
                }
                if (body is not null) request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                requestStarted = Stopwatch.GetTimestamp();
                requestSent = true;
                using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                responseStatus = (int)response.StatusCode;
                var text = await response.Content.ReadAsStringAsync(timeout.Token);
                responseBytes = Encoding.UTF8.GetByteCount(text);
                JsonObject json;
                try { json = JsonNode.Parse(text) as JsonObject ?? new JsonObject { ["raw"] = text }; }
                catch { json = new JsonObject { ["raw"] = text }; }
                if (response.IsSuccessStatusCode)
                {
                    outcome = "success";
                    return json;
                }
                var retryable = response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
                if (retryable && attempt < retries)
                {
                    outcome = "retry";
                    var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromMilliseconds(650 * Math.Pow(2, attempt));
                    responseRetryDelay = retryAfter + TimeSpan.FromMilliseconds(Random.Shared.Next(80, 240));
                    continue;
                }
                outcome = "http-error";
                logError = First(Value.String(json, "message"), Value.String(json, "error"), $"HTTP {(int)response.StatusCode}");
                throw new ApiException(logError,
                    "HTTP_ERROR", (int)response.StatusCode);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                outcome = "timeout";
                logError = "Превышено время ожидания ответа API";
                lastError = new ApiException("Превышено время ожидания ответа API", "TIMEOUT", 504);
            }
            catch (OperationCanceledException)
            {
                outcome = "cancelled";
                logError = "Запрос остановлен пользователем";
                throw;
            }
            catch (HttpRequestException error)
            {
                outcome = "network-error";
                logError = error.Message;
                lastError = error;
            }
            catch (ApiException error) when ((error.Status == 429 || error.Status >= 500) && attempt < retries)
            {
                outcome = "retry";
                logError = error.Message;
                lastError = error;
            }
            finally
            {
                if (requestSent)
                {
                    var durationMs = Stopwatch.GetElapsedTime(requestStarted).TotalMilliseconds;
                    await OutboundRequests.AddAsync(OutboundRequestEntry.Create(
                        OutboundRequests.NextId(),
                        method.Method,
                        url,
                        body,
                        responseStatus,
                        durationMs,
                        attempt + 1,
                        retries + 1,
                        outcome,
                        responseBytes,
                        logError));
                }
                if (responseRetryDelay is { } delay) await Task.Delay(delay, cancellationToken);
            }
            if (attempt < retries)
                await Task.Delay(TimeSpan.FromMilliseconds(650 * Math.Pow(2, attempt) + Random.Shared.Next(80, 240)), cancellationToken);
        }
        if (lastError is ApiException apiError) throw apiError;
        throw new ApiException(lastError?.Message ?? "Неизвестная ошибка сети", "NETWORK_ERROR", 502, lastError);
    }

    private async Task<JsonNode> CoalesceAsync(string key, Func<Task<JsonNode>> factory)
    {
        var lazy = _inFlight.GetOrAdd(key, _ => new Lazy<Task<JsonNode>>(factory, LazyThreadSafetyMode.ExecutionAndPublication));
        try { return (await lazy.Value).DeepClone(); }
        finally { _inFlight.TryRemove(new KeyValuePair<string, Lazy<Task<JsonNode>>>(key, lazy)); }
    }

    private static JsonArray FallbackCompanies(Project project) => new(project.TargetOrder.Concat(project.DefaultExclusions)
        .Where(value => value.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(label => (JsonNode)new JsonObject { ["id"] = null, ["label"] = label }).ToArray());

    private static string DeliveryMethodLabel(JsonObject item)
    {
        var direct = First(Value.String(item, "deliveryMethodLabel"), Value.String(item, "deliveryMethodName"));
        if (direct.Length > 0) return direct;
        return Value.Int(item, "deliveryMethod", -1) switch
        {
            1 => "дверь-дверь",
            8 or 4 => "дверь-склад",
            6 or 3 => "склад-дверь",
            7 or 2 => "склад-склад",
            var value => $"режим {value}"
        };
    }

    private static double? Number(JsonObject source, params string[] keys)
    {
        foreach (var key in keys)
        {
            var node = source[key];
            if (node is null) continue;
            if (double.TryParse(node.ToString().Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var value)) return value;
        }
        return null;
    }

    private static double? Discount(double userPrice, double? retailPrice)
    {
        if (!(userPrice > 0) || !(retailPrice > 0)) return null;
        if (userPrice >= retailPrice) return 0;
        return Math.Ceiling((retailPrice.Value - userPrice) / retailPrice.Value * 100);
    }

    private static JsonNode CloneCollection(JsonNode? node) => node is JsonArray or JsonObject ? node.DeepClone() : new JsonArray();
    private static string First(params string[] values) => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
    private static string[] StringArray(JsonObject source, string key) => source[key] is JsonArray array
        ? array.Select(item => item?.ToString() ?? "").Where(value => value.Length > 0).ToArray()
        : [];
    private static string Normalize(string value) => string.Join(' ', value.Trim().ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    private static string AccountScope(string projectId, string email) => ShortHash($"{projectId}|{Normalize(email)}");
    private static string ShortHash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant()[..16];
    private static string BuildUrl(string baseUrl, IReadOnlyDictionary<string, string> query)
    {
        var separator = baseUrl.Contains('?') ? '&' : '?';
        return baseUrl + separator + string.Join('&', query.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
    }

    private static bool HasApiErrors(JsonObject response) => response["error"] is not null || response["errors"] is JsonObject or JsonArray;
    private static string FindOrderId(JsonObject response)
    {
        var candidates = new[]
        {
            Value.String(response, "id"), Value.String(response, "orderId"), Value.String(response, "requestId"),
            Value.String(response["attributes"] as JsonObject ?? [], "id"),
            Value.String(response["data"] as JsonObject ?? [], "id"),
            Value.String(response["result"] as JsonObject ?? [], "id")
        };
        return candidates.FirstOrDefault(value => value.Length > 0) ?? "";
    }

    private static string ApiErrorMessage(JsonObject response, string fallback)
    {
        var messages = new List<string>();
        CollectMessages(response["error"], "", messages);
        CollectMessages(response["errors"], "", messages);
        CollectMessages(response["message"], "", messages);
        return messages.Distinct(StringComparer.OrdinalIgnoreCase).FirstOrDefault() ?? fallback;
    }

    private static void CollectMessages(JsonNode? node, string prefix, ICollection<string> messages)
    {
        if (node is null) return;
        if (node is JsonValue)
        {
            var text = node.ToString();
            if (text.Length > 0 && text != "false") messages.Add(prefix.Length > 0 ? $"{prefix}: {text}" : text);
            return;
        }
        if (node is JsonArray array)
        {
            foreach (var item in array) CollectMessages(item, prefix, messages);
            return;
        }
        if (node is JsonObject obj)
        {
            foreach (var (key, value) in obj)
                CollectMessages(value, key is "message" or "error" or "title" ? prefix : key, messages);
        }
    }

    public void Dispose()
    {
        Cache.Flush();
        _http.Dispose();
    }
}

sealed record Project(string Id, string Label, string ShortLabel, string BaseUrl, string SortStrategy,
    string[] TargetOrder, string[] DefaultExclusions, int[] DefaultExcludedIds, string DefaultBestMethod)
{
    public static readonly Project[] All =
    [
        new("kd", "Курьер Дисконт", "КД", "https://lk.kdiscont.ru", "company",
            ["OPS", "CSE", "MExpress", "CDEK", "DPD", "Flip Post", "PonyExpress", "Деловые линии", "Байкал Сервис"],
            ["Достависта", "Пешкарики", "Dimex", "FoxExpress", "Яндекс Доставка", "Global Delivery", "TNT", "UPS"],
            [2, 6, 12, 14, 17, 19, 16, 15], "door"),
        new("me", "ME Express", "ME", "https://lk.m1express.ru", "urgency", [],
            ["Достависта", "Пешкарики", "Dimex", "FoxExpress", "Яндекс Доставка", "Global Delivery", "TNT", "UPS"],
            [2, 6, 12, 14, 17, 19, 16, 15], "all"),
        new("ops", "OPSPost", "OPS", "https://lk.opspost.ru", "urgency", [],
            ["Достависта", "Пешкарики", "Dimex", "FoxExpress", "Яндекс Доставка", "Global Delivery", "TNT", "UPS"],
            [2, 6, 12, 14, 17, 19, 16, 15], "all")
    ];

    public static Project Get(string id) => All.FirstOrDefault(project => project.Id == id) ?? All[0];
}

sealed class ApiException : Exception
{
    public string Code { get; }
    public int Status { get; }
    public ApiException(string message, string code = "API_ERROR", int status = 500, Exception? inner = null) : base(message, inner)
    {
        Code = code;
        Status = status;
    }
}

static class Value
{
    public static JsonNode? Node(JsonObject source, string key) => source[key]?.DeepClone();
    public static JsonNode? FirstNode(JsonObject source, params string[] keys)
    {
        foreach (var key in keys) if (source[key] is { } node) return node.DeepClone();
        return null;
    }
    public static string String(JsonObject source, string key, string fallback = "")
    {
        var node = source[key];
        if (node is null) return fallback;
        try { return node.GetValue<string>(); }
        catch { return node.ToString(); }
    }
    public static bool Bool(JsonObject source, string key, bool fallback = false)
    {
        var node = source[key];
        if (node is null) return fallback;
        if (bool.TryParse(node.ToString(), out var value)) return value;
        if (int.TryParse(node.ToString(), out var number)) return number != 0;
        return fallback;
    }
    public static bool False(JsonObject source, string key) => source.ContainsKey(key) && !Bool(source, key, true);
    public static int Int(JsonObject source, string key, int fallback = 0)
    {
        return int.TryParse(source[key]?.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : fallback;
    }
    public static double Double(JsonObject source, string key, double fallback = 0)
    {
        return double.TryParse(source[key]?.ToString().Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : fallback;
    }
}

sealed record CacheMetadata(DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, string Category, string ProjectId, string? ClientId, bool Persist);
sealed record CacheRecord(JsonNode Value, CacheMetadata Metadata);

sealed class ServerCache
{
    private readonly ConcurrentDictionary<string, CacheRecord> _items = new(StringComparer.Ordinal);
    private readonly string _path;
    private readonly object _diskLock = new();
    private int _dirtyVersion;
    private int _saveScheduled;

    public ServerCache()
    {
        var directory = Environment.GetEnvironmentVariable("OPS_TOOLKIT_DATA")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OPS Toolkit Desktop");
        try { Directory.CreateDirectory(directory); }
        catch (UnauthorizedAccessException)
        {
            directory = Path.Combine(AppContext.BaseDirectory, "data");
            Directory.CreateDirectory(directory);
        }
        _path = Path.Combine(directory, "server-cache-v1.json");
        Load();
    }

    public bool TryGet(string key, out JsonNode? value, out CacheMetadata? metadata)
    {
        value = null;
        metadata = null;
        if (!_items.TryGetValue(key, out var record)) return false;
        if (record.Metadata.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            _items.TryRemove(key, out _);
            MarkDirty();
            return false;
        }
        value = record.Value.DeepClone();
        metadata = record.Metadata;
        return true;
    }

    public void Set(string key, JsonNode value, TimeSpan ttl, string category, string projectId, string? clientId, bool persist = true)
    {
        var now = DateTimeOffset.UtcNow;
        _items[key] = new CacheRecord(value.DeepClone(), new CacheMetadata(now, now.Add(ttl), category, projectId, clientId, persist));
        Trim();
        if (persist) MarkDirty();
    }

    public void Remove(string key)
    {
        if (_items.TryRemove(key, out var removed) && removed.Metadata.Persist) MarkDirty();
    }

    public void Clear(string category, string projectId)
    {
        var categories = category switch
        {
            "lk" => new HashSet<string>(["auth", "users", "companies"]),
            "calculator" => new HashSet<string>(["calculations"]),
            "all" => null,
            _ => new HashSet<string>([category])
        };
        var changed = false;
        foreach (var (key, record) in _items)
        {
            var categoryMatch = categories is null || categories.Contains(record.Metadata.Category);
            var projectMatch = projectId.Length == 0 || record.Metadata.ProjectId.Length == 0 || record.Metadata.ProjectId == projectId;
            if (categoryMatch && projectMatch && _items.TryRemove(key, out _)) changed |= record.Metadata.Persist;
        }
        if (changed) MarkDirty();
    }

    public object Summary()
    {
        RemoveExpired();
        return new
        {
            entries = _items.Count,
            calculations = _items.Values.Count(item => item.Metadata.Category == "calculations"),
            clients = _items.Values.Where(item => item.Metadata.ClientId is { Length: > 0 }).Select(item => item.Metadata.ClientId).Distinct().Count(),
            diskPath = _path
        };
    }

    public object Stats()
    {
        RemoveExpired();
        var groups = _items.Values.GroupBy(item => item.Metadata.Category).ToDictionary(group => group.Key, group => new
        {
            entries = group.Count(),
            bytes = group.Sum(item => ApproximateBytes(item.Value)),
            minTtlMs = group.Min(item => Math.Max(0, (item.Metadata.ExpiresAt - DateTimeOffset.UtcNow).TotalMilliseconds)),
            maxTtlMs = group.Max(item => Math.Max(0, (item.Metadata.ExpiresAt - DateTimeOffset.UtcNow).TotalMilliseconds))
        });
        return new { groups, totalEntries = _items.Count, totalBytes = ApproximateBytes(), inFlight = 0, expiredEntries = 0 };
    }

    public object Describe(string? projectId, string? clientId)
    {
        RemoveExpired();
        return _items.Select(pair => new
            {
                keyHash = Hash(pair.Key),
                pair.Value.Metadata.Category,
                pair.Value.Metadata.ProjectId,
                pair.Value.Metadata.ClientId,
                pair.Value.Metadata.CreatedAt,
                pair.Value.Metadata.ExpiresAt
            })
            .Where(item => string.IsNullOrWhiteSpace(projectId) || item.ProjectId == projectId)
            .Where(item => string.IsNullOrWhiteSpace(clientId) || item.ClientId == clientId)
            .OrderByDescending(item => item.CreatedAt)
            .Take(500)
            .ToArray();
    }

    private void Trim()
    {
        if (_items.Count <= 1800) return;
        foreach (var item in _items.OrderBy(pair => pair.Value.Metadata.ExpiresAt).Take(300)) _items.TryRemove(item.Key, out _);
        MarkDirty();
    }

    private void RemoveExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var changed = false;
        foreach (var (key, record) in _items)
            if (record.Metadata.ExpiresAt <= now && _items.TryRemove(key, out _)) changed |= record.Metadata.Persist;
        if (changed) MarkDirty();
    }

    private long ApproximateBytes()
    {
        try { return Encoding.UTF8.GetByteCount(JsonSerializer.Serialize(_items)); }
        catch { return 0; }
    }

    private static long ApproximateBytes(JsonNode value)
    {
        try { return Encoding.UTF8.GetByteCount(value.ToJsonString()); }
        catch { return 0; }
    }

    private static string Hash(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant()[..16];

    private void MarkDirty()
    {
        Interlocked.Increment(ref _dirtyVersion);
        if (Interlocked.Exchange(ref _saveScheduled, 1) == 1) return;
        _ = Task.Run(async () =>
        {
            await Task.Delay(1200);
            Flush();
            Interlocked.Exchange(ref _saveScheduled, 0);
            if (_dirtyVersion > 0) MarkDirty();
        });
    }

    public void Flush()
    {
        var version = Interlocked.Exchange(ref _dirtyVersion, 0);
        if (version == 0) return;
        try
        {
            lock (_diskLock)
            {
                var snapshot = _items.Where(pair => pair.Value.Metadata.Persist && pair.Value.Metadata.ExpiresAt > DateTimeOffset.UtcNow)
                    .ToDictionary(pair => pair.Key, pair => pair.Value);
                var temp = _path + ".tmp";
                File.WriteAllText(temp, JsonSerializer.Serialize(snapshot), Encoding.UTF8);
                File.Move(temp, _path, true);
            }
        }
        catch
        {
            Interlocked.Add(ref _dirtyVersion, version);
        }
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_path)) return;
            var records = JsonSerializer.Deserialize<Dictionary<string, CacheRecord>>(File.ReadAllText(_path, Encoding.UTF8));
            if (records is null) return;
            var now = DateTimeOffset.UtcNow;
            foreach (var (key, record) in records)
                if (record.Metadata.Persist && record.Metadata.ExpiresAt > now) _items[key] = record;
        }
        catch
        {
            // A damaged cache is ignored; network results will rebuild it.
        }
    }
}

sealed class RateGate
{
    private readonly int _limit;
    private readonly TimeSpan _window;
    private readonly Queue<DateTimeOffset> _starts = new();
    private readonly SemaphoreSlim _mutex = new(1, 1);
    private int _waiting;

    public RateGate(int limit, TimeSpan window)
    {
        _limit = limit;
        _window = window;
    }

    public async Task WaitAsync(CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref _waiting);
        try
        {
            while (true)
            {
                await _mutex.WaitAsync(cancellationToken);
                TimeSpan delay;
                try
                {
                    var now = DateTimeOffset.UtcNow;
                    while (_starts.Count > 0 && now - _starts.Peek() >= _window) _starts.Dequeue();
                    if (_starts.Count < _limit)
                    {
                        _starts.Enqueue(now);
                        return;
                    }
                    delay = _window - (now - _starts.Peek());
                }
                finally { _mutex.Release(); }
                if (delay > TimeSpan.Zero) await Task.Delay(delay, cancellationToken);
            }
        }
        finally { Interlocked.Decrement(ref _waiting); }
    }

    public object Stats() => new { limit = _limit, queued = Math.Max(0, _waiting), recentStarts = _starts.Count };
}

sealed class DynamicConcurrencyGate
{
    private readonly object _sync = new();
    private readonly int _hardMax;
    private int _active;
    private readonly Queue<Waiter> _queue = new();

    public DynamicConcurrencyGate(int hardMax) => _hardMax = hardMax;

    public Task<AsyncLease> AcquireAsync(int requestedMax, CancellationToken cancellationToken)
    {
        var max = Math.Clamp(requestedMax, 1, _hardMax);
        lock (_sync)
        {
            if (_active < max && _queue.Count == 0)
            {
                _active++;
                return Task.FromResult(new AsyncLease(Release));
            }
            var waiter = new Waiter(max);
            _queue.Enqueue(waiter);
            if (cancellationToken.CanBeCanceled)
                waiter.Registration = cancellationToken.Register(() => waiter.Source.TrySetCanceled(cancellationToken));
            return waiter.Source.Task;
        }
    }

    private void Release()
    {
        lock (_sync)
        {
            _active = Math.Max(0, _active - 1);
            while (_queue.Count > 0)
            {
                var waiter = _queue.Peek();
                if (waiter.Source.Task.IsCompleted)
                {
                    _queue.Dequeue();
                    waiter.Registration.Dispose();
                    continue;
                }
                if (_active >= waiter.Max) break;
                _queue.Dequeue();
                waiter.Registration.Dispose();
                _active++;
                waiter.Source.TrySetResult(new AsyncLease(Release));
            }
        }
    }

    public object Stats()
    {
        lock (_sync) return new { active = _active, queued = _queue.Count, max = _hardMax };
    }

    private sealed class Waiter(int max)
    {
        public int Max { get; } = max;
        public TaskCompletionSource<AsyncLease> Source { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public CancellationTokenRegistration Registration { get; set; }
    }
}

sealed class AsyncLease : IAsyncDisposable
{
    private Action? _release;
    public static AsyncLease Empty { get; } = new(null);
    public AsyncLease(Action? release) => _release = release;
    public ValueTask DisposeAsync()
    {
        Interlocked.Exchange(ref _release, null)?.Invoke();
        return ValueTask.CompletedTask;
    }
}

sealed record RequestTrace(string Id, DateTimeOffset At, string Action, string ProjectId, string ClientId,
    bool Ok, double DurationMs, bool Cached, string Code, string Error, int Status)
{
    public static RequestTrace Success(string id, string action, JsonObject payload, double durationMs, bool cached) =>
        new(id, DateTimeOffset.UtcNow, action, Value.String(payload, "projectId"), Value.String(payload, "userId"), true,
            Math.Round(durationMs, 1), cached, "", "", 200);

    public static RequestTrace Failure(string id, string action, JsonObject payload, double durationMs, string code, string error, int status) =>
        new(id, DateTimeOffset.UtcNow, action, Value.String(payload, "projectId"), Value.String(payload, "userId"), false,
            Math.Round(durationMs, 1), false, code, error, status);
}

sealed class TraceStore
{
    private readonly ConcurrentQueue<RequestTrace> _items = new();
    private long _sequence;
    public string NextId() => $"{DateTimeOffset.UtcNow:yyMMddHHmmss}-{Interlocked.Increment(ref _sequence):x4}";
    public void Add(RequestTrace trace)
    {
        _items.Enqueue(trace);
        while (_items.Count > 300) _items.TryDequeue(out _);
    }
    public IEnumerable<RequestTrace> List(int limit) => _items.Reverse().Take(limit);
    public RequestTrace? Get(string id) => _items.FirstOrDefault(item => item.Id == id);
}

sealed record OutboundRequestEntry(
    string Id,
    DateTimeOffset At,
    string Method,
    string Url,
    int? Status,
    double DurationMs,
    int Attempt,
    int TotalAttempts,
    string Outcome,
    int RequestBytes,
    int ResponseBytes,
    string RequestBody,
    string Error)
{
    public static OutboundRequestEntry Create(string id, string method, string url, string? body, int? status,
        double durationMs, int attempt, int totalAttempts, string outcome, int responseBytes, string error) =>
        new(
            id,
            DateTimeOffset.UtcNow,
            method,
            RequestLogSanitizer.Url(url),
            status,
            Math.Round(durationMs, 1),
            attempt,
            totalAttempts,
            outcome,
            body is null ? 0 : Encoding.UTF8.GetByteCount(body),
            responseBytes,
            RequestLogSanitizer.Body(body),
            RequestLogSanitizer.Text(error, 500));
}

sealed class OutboundRequestStore
{
    public const long MaxFileBytes = 10 * 1024 * 1024;
    private const long CompactTargetBytes = 6 * 1024 * 1024;
    private readonly ConcurrentQueue<OutboundRequestEntry> _items = new();
    private readonly SemaphoreSlim _fileLock = new(1, 1);
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly string _path;
    private long _sequence;

    public OutboundRequestStore()
    {
        var directory = Environment.GetEnvironmentVariable("OPS_TOOLKIT_DATA")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OPS Toolkit Desktop");
        try { Directory.CreateDirectory(directory); }
        catch (UnauthorizedAccessException)
        {
            directory = Path.Combine(AppContext.BaseDirectory, "data");
            Directory.CreateDirectory(directory);
        }
        _path = Path.Combine(directory, "outbound-requests.jsonl");
        LoadRecent();
    }

    public string NextId() => $"{DateTimeOffset.UtcNow:yyMMddHHmmssfff}-{Interlocked.Increment(ref _sequence):x4}";

    public async Task AddAsync(OutboundRequestEntry entry)
    {
        _items.Enqueue(entry);
        while (_items.Count > 1000) _items.TryDequeue(out _);
        var line = JsonSerializer.Serialize(entry, _jsonOptions) + Environment.NewLine;
        var lineBytes = Encoding.UTF8.GetByteCount(line);
        await _fileLock.WaitAsync();
        try
        {
            if (File.Exists(_path) && new FileInfo(_path).Length + lineBytes > MaxFileBytes) CompactFile();
            await File.AppendAllTextAsync(_path, line, new UTF8Encoding(false));
        }
        catch
        {
            // Diagnostics must never interrupt calculations or order creation.
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public object Snapshot(int limit)
    {
        long size = 0;
        try { if (File.Exists(_path)) size = new FileInfo(_path).Length; }
        catch { }
        return new
        {
            entries = _items.Reverse().Take(limit).ToArray(),
            filePath = _path,
            sizeBytes = size,
            maxBytes = MaxFileBytes
        };
    }

    public async Task ClearAsync()
    {
        await _fileLock.WaitAsync();
        try
        {
            while (_items.TryDequeue(out _)) { }
            if (File.Exists(_path)) File.Delete(_path);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    private void LoadRecent()
    {
        try
        {
            if (!File.Exists(_path)) return;
            foreach (var line in File.ReadLines(_path).TakeLast(1000))
            {
                var entry = JsonSerializer.Deserialize<OutboundRequestEntry>(line, _jsonOptions);
                if (entry is not null) _items.Enqueue(entry);
            }
        }
        catch
        {
            while (_items.TryDequeue(out _)) { }
        }
    }

    private void CompactFile()
    {
        try
        {
            var kept = new Stack<string>();
            long keptBytes = 0;
            foreach (var line in File.ReadLines(_path).Reverse())
            {
                var bytes = Encoding.UTF8.GetByteCount(line) + Environment.NewLine.Length;
                if (keptBytes + bytes > CompactTargetBytes) break;
                kept.Push(line);
                keptBytes += bytes;
            }
            File.WriteAllLines(_path, kept, new UTF8Encoding(false));
        }
        catch
        {
            File.WriteAllText(_path, "", new UTF8Encoding(false));
        }
    }
}

static class RequestLogSanitizer
{
    private static readonly string[] SensitiveFragments =
    [
        "token", "password", "passwd", "authorization", "cookie", "secret", "apikey",
        "email", "phone", "inn", "passport", "address", "contact", "sender_name",
        "recipient_name", "query"
    ];

    public static string Url(string raw)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri)) return Text(raw, 2000);
        var baseUrl = $"{uri.Scheme}://{uri.Authority}{uri.AbsolutePath}";
        if (string.IsNullOrEmpty(uri.Query)) return baseUrl;
        var parts = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(part =>
            {
                var pair = part.Split('=', 2);
                var key = Uri.UnescapeDataString(pair[0].Replace("+", " "));
                var value = pair.Length > 1 ? Uri.UnescapeDataString(pair[1].Replace("+", " ")) : "";
                return $"{key}={(IsSensitive(key) ? "***" : Text(value, 180))}";
            });
        return baseUrl + "?" + string.Join("&", parts);
    }

    public static string Body(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        try
        {
            var node = JsonNode.Parse(raw);
            return Text(SanitizeNode(node, "").ToJsonString(), 4000);
        }
        catch
        {
            return $"[тело не в JSON, {Encoding.UTF8.GetByteCount(raw)} байт]";
        }
    }

    public static string Text(string? value, int maxLength)
    {
        var text = (value ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
        return text.Length <= maxLength ? text : text[..maxLength] + "…";
    }

    private static JsonNode SanitizeNode(JsonNode? node, string key)
    {
        if (node is null) return JsonValue.Create((string?)null)!;
        if (IsSensitive(key)) return JsonValue.Create("***")!;
        if (node is JsonObject obj)
        {
            var result = new JsonObject();
            foreach (var (childKey, value) in obj) result[childKey] = SanitizeNode(value, childKey);
            return result;
        }
        if (node is JsonArray array)
        {
            var result = new JsonArray();
            foreach (var value in array) result.Add(SanitizeNode(value, key));
            return result;
        }
        return node.DeepClone();
    }

    private static bool IsSensitive(string key)
    {
        var normalized = key.Replace("-", "").Replace("_", "").ToLowerInvariant();
        return SensitiveFragments.Any(fragment => normalized.Contains(fragment.Replace("_", ""), StringComparison.Ordinal));
    }
}
