# 快速获取 SHA1 脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   快速获取 SHA1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 查找 Java
$javaCheck = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCheck) {
    # 尝试查找 Java
    $javaPaths = @(
        "$env:JAVA_HOME\bin\java.exe",
        "$env:ProgramFiles\Java\*\bin\java.exe",
        "$env:ProgramFiles\Eclipse Adoptium\*\bin\java.exe"
    )
    
    foreach ($path in $javaPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $javaExe = $resolved[0].Path
            $javaDir = Split-Path (Split-Path $javaExe) -Parent
            $env:PATH = "$javaDir\bin;$env:PATH"
            break
        }
    }
}

# 验证 Java
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✅ Java: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 Java，请先安装 JDK" -ForegroundColor Red
    Write-Host "下载地址: https://adoptium.net/" -ForegroundColor Yellow
    pause
    exit
}

Write-Host ""
Write-Host "📦 包名: com.mobileapp.app" -ForegroundColor Cyan
Write-Host ""

# 获取调试版 SHA1
Write-Host "🔍 获取调试版 SHA1..." -ForegroundColor Cyan
$debugKeystore = "$env:USERPROFILE\.android\debug.keystore"

if (Test-Path $debugKeystore) {
    Write-Host "   找到调试版 keystore" -ForegroundColor Green
    $result = keytool -list -v -keystore $debugKeystore -storepass android -keypass android 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $sha1Line = $result | Select-String -Pattern "SHA1:"
        if ($sha1Line) {
            $sha1 = ($sha1Line -split 'SHA1:')[1].Trim()
            Write-Host ""
            Write-Host "   ✅ 调试版 SHA1:" -ForegroundColor Green
            Write-Host "   $sha1" -ForegroundColor White
            Write-Host ""
        }
    }
} else {
    Write-Host "   调试版 keystore 不存在，正在创建..." -ForegroundColor Yellow
    
    # 确保目录存在
    $androidDir = "$env:USERPROFILE\.android"
    if (-not (Test-Path $androidDir)) {
        New-Item -ItemType Directory -Path $androidDir -Force | Out-Null
    }
    
    # 创建调试版 keystore
    Write-Host "   请按照提示输入信息（可以直接按回车使用默认值）" -ForegroundColor Yellow
    keytool -genkeypair -v -keystore $debugKeystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
    
    if (Test-Path $debugKeystore) {
        Write-Host ""
        Write-Host "   ✅ 调试版 keystore 创建成功!" -ForegroundColor Green
        
        # 获取 SHA1
        $result = keytool -list -v -keystore $debugKeystore -storepass android -keypass android 2>&1
        $sha1Line = $result | Select-String -Pattern "SHA1:"
        if ($sha1Line) {
            $sha1 = ($sha1Line -split 'SHA1:')[1].Trim()
            Write-Host ""
            Write-Host "   ✅ 调试版 SHA1:" -ForegroundColor Green
            Write-Host "   $sha1" -ForegroundColor White
            Write-Host ""
        }
    }
}

# 创建发布版 keystore
Write-Host "🔍 检查发布版 keystore..." -ForegroundColor Cyan
$releaseKeystore = "F:\A\mobile-app\release.keystore"

if (-not (Test-Path $releaseKeystore)) {
    Write-Host "   发布版 keystore 不存在" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   是否创建发布版 keystore? (Y/N)" -ForegroundColor Yellow
    $create = Read-Host
    
    if ($create -eq "Y" -or $create -eq "y") {
        Write-Host ""
        Write-Host "   正在创建发布版 keystore..." -ForegroundColor Cyan
        Write-Host "   请按照提示输入信息:" -ForegroundColor Yellow
        Write-Host "   - 密钥库密码: 自己设置（请记住！）" -ForegroundColor Gray
        Write-Host "   - 其他信息: 可以直接按回车使用默认值" -ForegroundColor Gray
        Write-Host ""
        
        keytool -genkeypair -v -keystore $releaseKeystore -alias release-key -keyalg RSA -keysize 2048 -validity 10000
        
        if (Test-Path $releaseKeystore) {
            Write-Host ""
            Write-Host "   ✅ 发布版 keystore 创建成功!" -ForegroundColor Green
            Write-Host "   文件位置: $releaseKeystore" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   请输入密码以获取发布版 SHA1:" -ForegroundColor Yellow
            $password = Read-Host "   密码" -AsSecureString
            $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
            
            $result = keytool -list -v -keystore $releaseKeystore -alias release-key -storepass $plainPassword 2>&1
            $sha1Line = $result | Select-String -Pattern "SHA1:"
            if ($sha1Line) {
                $sha1 = ($sha1Line -split 'SHA1:')[1].Trim()
                Write-Host ""
                Write-Host "   ✅ 发布版 SHA1:" -ForegroundColor Green
                Write-Host "   $sha1" -ForegroundColor White
                Write-Host ""
            }
        }
    }
} else {
    Write-Host "   找到发布版 keystore" -ForegroundColor Green
    Write-Host "   请输入密码以获取发布版 SHA1:" -ForegroundColor Yellow
    $password = Read-Host "   密码" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
    
    $result = keytool -list -v -keystore $releaseKeystore -alias release-key -storepass $plainPassword 2>&1
    $sha1Line = $result | Select-String -Pattern "SHA1:"
    if ($sha1Line) {
        $sha1 = ($sha1Line -split 'SHA1:')[1].Trim()
        Write-Host ""
        Write-Host "   ✅ 发布版 SHA1:" -ForegroundColor Green
        Write-Host "   $sha1" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   填写高德地图平台" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "包名 (PackageName): com.mobileapp.app" -ForegroundColor White
Write-Host ""
Write-Host "请将上面的 SHA1 值填写到高德地图平台" -ForegroundColor Yellow
Write-Host ""
pause

