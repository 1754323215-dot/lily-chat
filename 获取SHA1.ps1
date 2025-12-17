# 获取 Android 应用 SHA1 脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   获取 Android 应用 SHA1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Java 是否安装
$javaCheck = Get-Command java -ErrorAction SilentlyContinue

# 如果找不到，尝试查找 Java 安装路径
if (-not $javaCheck) {
    Write-Host "🔍 正在查找 Java 安装路径..." -ForegroundColor Cyan
    
    # 常见的 Java 安装路径
    $javaPaths = @(
        "$env:JAVA_HOME\bin\java.exe",
        "$env:ProgramFiles\Java\*\bin\java.exe",
        "$env:ProgramFiles\Eclipse Adoptium\*\bin\java.exe",
        "$env:ProgramFiles(x86)\Java\*\bin\java.exe",
        "C:\Program Files\Java\*\bin\java.exe",
        "C:\Program Files\Eclipse Adoptium\*\bin\java.exe"
    )
    
    $javaFound = $false
    foreach ($path in $javaPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $javaExe = $resolved[0].Path
            $javaDir = Split-Path (Split-Path $javaExe) -Parent
            $env:PATH = "$javaDir\bin;$env:PATH"
            Write-Host "   ✅ 找到 Java: $javaExe" -ForegroundColor Green
            $javaFound = $true
            break
        }
    }
    
    # 如果还是找不到，尝试搜索整个系统
    if (-not $javaFound) {
        Write-Host "   🔍 正在搜索系统..." -ForegroundColor Yellow
        $searchPaths = @(
            "C:\Program Files",
            "C:\Program Files (x86)",
            "$env:LOCALAPPDATA\Programs"
        )
        
        foreach ($searchPath in $searchPaths) {
            if (Test-Path $searchPath) {
                $javaDirs = Get-ChildItem -Path $searchPath -Filter "java.exe" -Recurse -ErrorAction SilentlyContinue -Depth 3 | Where-Object { $_.FullName -like "*\bin\java.exe" }
                if ($javaDirs) {
                    $javaExe = $javaDirs[0].FullName
                    $javaDir = Split-Path (Split-Path $javaExe) -Parent
                    $env:PATH = "$javaDir\bin;$env:PATH"
                    Write-Host "   ✅ 找到 Java: $javaExe" -ForegroundColor Green
                    $javaFound = $true
                    break
                }
            }
        }
    }
    
    if (-not $javaFound) {
        Write-Host ""
        Write-Host "❌ 错误: 未找到 Java" -ForegroundColor Red
        Write-Host ""
        Write-Host "请先安装 Java JDK:" -ForegroundColor Yellow
        Write-Host "1. 访问: https://adoptium.net/" -ForegroundColor Yellow
        Write-Host "2. 下载 JDK 17 LTS" -ForegroundColor Yellow
        Write-Host "3. 安装后重新打开 PowerShell 并运行此脚本" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "或者告诉我 Java 的安装路径，我可以帮你配置" -ForegroundColor Yellow
        Write-Host ""
        pause
        exit
    }
}

# 验证 Java 是否可用
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✅ Java 已找到: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Java 无法运行" -ForegroundColor Red
    pause
    exit
}

Write-Host "✅ Java 已安装" -ForegroundColor Green
Write-Host ""

# 包名信息
Write-Host "📦 包名 (PackageName):" -ForegroundColor Cyan
Write-Host "   com.mobileapp.app" -ForegroundColor White
Write-Host ""

# 获取调试版 SHA1
Write-Host "🔍 正在获取调试版 SHA1..." -ForegroundColor Cyan
$debugKeystore = "$env:USERPROFILE\.android\debug.keystore"

if (Test-Path $debugKeystore) {
    Write-Host "   找到调试版 keystore: $debugKeystore" -ForegroundColor Green
    Write-Host ""
    
    $debugSHA1 = keytool -list -v -keystore $debugKeystore -storepass android -keypass android 2>$null | Select-String -Pattern "SHA1:" | ForEach-Object { ($_ -split ':')[1].Trim() }
    
    if ($debugSHA1) {
        Write-Host "   ✅ 调试版 SHA1:" -ForegroundColor Green
        Write-Host "   $debugSHA1" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "   ⚠️  无法获取 SHA1，请检查 keystore" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "   ⚠️  调试版 keystore 不存在" -ForegroundColor Yellow
    Write-Host "   位置: $debugKeystore" -ForegroundColor Gray
    Write-Host "   首次运行应用时会自动创建" -ForegroundColor Gray
    Write-Host ""
}

# 检查发布版 keystore
Write-Host "🔍 检查发布版 keystore..." -ForegroundColor Cyan
$releaseKeystore = "F:\A\mobile-app\release.keystore"

if (Test-Path $releaseKeystore) {
    Write-Host "   ✅ 找到发布版 keystore: $releaseKeystore" -ForegroundColor Green
    Write-Host ""
    Write-Host "   请输入 keystore 密码以获取 SHA1:" -ForegroundColor Yellow
    $password = Read-Host "   密码" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
    
    $releaseSHA1 = keytool -list -v -keystore $releaseKeystore -alias release-key -storepass $plainPassword 2>$null | Select-String -Pattern "SHA1:" | ForEach-Object { ($_ -split ':')[1].Trim() }
    
    if ($releaseSHA1) {
        Write-Host ""
        Write-Host "   ✅ 发布版 SHA1:" -ForegroundColor Green
        Write-Host "   $releaseSHA1" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "   ❌ 密码错误或无法获取 SHA1" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "   ⚠️  发布版 keystore 不存在" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   是否创建发布版 keystore? (Y/N)" -ForegroundColor Yellow
    $create = Read-Host
    
    if ($create -eq "Y" -or $create -eq "y") {
        Write-Host ""
        Write-Host "   正在创建发布版 keystore..." -ForegroundColor Cyan
        Write-Host "   请按照提示输入信息:" -ForegroundColor Yellow
        Write-Host ""
        
        keytool -genkeypair -v -keystore $releaseKeystore -alias release-key -keyalg RSA -keysize 2048 -validity 10000
        
        if (Test-Path $releaseKeystore) {
            Write-Host ""
            Write-Host "   ✅ 发布版 keystore 创建成功!" -ForegroundColor Green
            Write-Host "   文件位置: $releaseKeystore" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   现在可以重新运行此脚本获取发布版 SHA1" -ForegroundColor Yellow
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   填写高德地图平台信息" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "包名 (PackageName): com.mobileapp.app" -ForegroundColor White
Write-Host ""
Write-Host "请将上面的 SHA1 值填写到高德地图平台" -ForegroundColor Yellow
Write-Host ""
pause

