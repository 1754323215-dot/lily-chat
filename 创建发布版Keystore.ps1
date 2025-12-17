# 创建发布版 Keystore 并获取 SHA1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   创建发布版 Keystore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 查找 Java
$javaCheck = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCheck) {
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

$releaseKeystore = "F:\A\mobile-app\release.keystore"

if (Test-Path $releaseKeystore) {
    Write-Host "⚠️  发布版 keystore 已存在" -ForegroundColor Yellow
    Write-Host "   文件位置: $releaseKeystore" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   是否重新创建? (Y/N)" -ForegroundColor Yellow
    $recreate = Read-Host
    
    if ($recreate -eq "Y" -or $recreate -eq "y") {
        Remove-Item $releaseKeystore -Force
        Write-Host "   已删除旧的 keystore" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "   请输入 keystore 密码以获取 SHA1:" -ForegroundColor Cyan
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
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "   填写高德地图平台" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "包名: com.mobileapp.app" -ForegroundColor White
            Write-Host "发布版 SHA1: $sha1" -ForegroundColor White
            Write-Host ""
            pause
            exit
        } else {
            Write-Host ""
            Write-Host "   ❌ 密码错误或无法获取 SHA1" -ForegroundColor Red
            pause
            exit
        }
    }
}

Write-Host "正在创建发布版 keystore..." -ForegroundColor Cyan
Write-Host ""
Write-Host "请按照提示输入信息:" -ForegroundColor Yellow
Write-Host "  - 密钥库密码: 请设置一个密码（请记住！）" -ForegroundColor Gray
Write-Host "  - 确认密码: 再次输入相同密码" -ForegroundColor Gray
Write-Host "  - 名字与姓氏: 可以填应用名或公司名" -ForegroundColor Gray
Write-Host "  - 其他信息: 可以直接按回车使用默认值" -ForegroundColor Gray
Write-Host ""

# 创建 keystore（使用交互式方式，让用户输入密码）
keytool -genkeypair -v -keystore $releaseKeystore -alias release-key -keyalg RSA -keysize 2048 -validity 10000

if (Test-Path $releaseKeystore) {
    Write-Host ""
    Write-Host "   ✅ 发布版 keystore 创建成功!" -ForegroundColor Green
    Write-Host "   文件位置: $releaseKeystore" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   请输入刚才设置的密码以获取 SHA1:" -ForegroundColor Cyan
    $password = Read-Host "   密码" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
    
    Write-Host ""
    Write-Host "   正在获取 SHA1..." -ForegroundColor Cyan
    
    $result = keytool -list -v -keystore $releaseKeystore -alias release-key -storepass $plainPassword 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $sha1Line = $result | Select-String -Pattern "SHA1:"
        if ($sha1Line) {
            $sha1 = ($sha1Line -split 'SHA1:')[1].Trim()
            Write-Host ""
            Write-Host "   ✅ 发布版 SHA1:" -ForegroundColor Green
            Write-Host "   $sha1" -ForegroundColor White
            Write-Host ""
            
            # 保存密码提示
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "   重要提示" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "⚠️  请妥善保管以下信息:" -ForegroundColor Yellow
            Write-Host "   - Keystore 文件: $releaseKeystore" -ForegroundColor White
            Write-Host "   - Keystore 密码: (你刚才设置的密码)" -ForegroundColor White
            Write-Host "   - Alias: release-key" -ForegroundColor White
            Write-Host ""
            Write-Host "   这些信息用于后续应用更新，丢失后无法更新应用！" -ForegroundColor Red
            Write-Host ""
            
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "   填写高德地图平台" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "包名 (PackageName): com.mobileapp.app" -ForegroundColor White
            Write-Host "发布版安全码 SHA1: $sha1" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "   ❌ 无法获取 SHA1，请检查密码是否正确" -ForegroundColor Red
        }
    } else {
        Write-Host ""
        Write-Host "   ❌ 密码错误，请重新运行脚本" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "   ❌ Keystore 创建失败" -ForegroundColor Red
}

Write-Host ""
pause

