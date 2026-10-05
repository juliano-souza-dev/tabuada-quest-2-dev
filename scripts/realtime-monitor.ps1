[CmdletBinding()]
param(
    [switch]$SkipPull
)

# Atualiza o projeto e garante que o servidor realtime e o Cloudflare Tunnel
# configurado em %USERPROFILE%\.cloudflared\config.yml estejam em execução.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

trap {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "Não foi possível iniciar o monitor realtime.`r`n`r`n$($_.Exception.Message)",
            'Tabuada Quest 2 — Realtime',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    finally {
        exit 1
    }
}

$repoRoot = $env:TQ_REALTIME_REPO
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    $repoRoot = Split-Path -Parent $PSScriptRoot
}
$repoRoot = [IO.Path]::GetFullPath($repoRoot)
$serverDirectory = Join-Path $repoRoot 'server'
$cloudflaredDirectory = Join-Path $env:USERPROFILE '.cloudflared'
$cloudflaredConfig = Join-Path $cloudflaredDirectory 'config.yml'
$logsDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'TabuadaQuest2\logs'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)

    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-RequiredCommandPath {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction Stop
    return $command.Source
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [Parameter(Mandatory)][string]$Description
    )

    & $FilePath @ArgumentList
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Description falhou (codigo $exitCode)."
    }
}

function Get-ListeningProcess {
    param([Parameter(Mandatory)][int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $listener) {
        return $null
    }

    return Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
}

function Wait-ForListeningPort {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $process = Get-ListeningProcess -Port $Port
        if ($process) {
            return $process
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $null
}

function Wait-ForPortToClose {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (-not (Get-ListeningProcess -Port $Port)) {
            return $true
        }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Get-TunnelProcesses {
    param(
        [Parameter(Mandatory)][string]$TunnelId,
        [Parameter(Mandatory)][string]$ConfigPath
    )

    $tunnelPattern = [regex]::Escape($TunnelId)
    $configPattern = [regex]::Escape($ConfigPath)

    return @(Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $commandLine = [string]$_.CommandLine
            $commandLine -match $tunnelPattern -or $commandLine -match $configPattern
        })
}

function Test-TunnelConnected {
    param(
        [Parameter(Mandatory)][string]$CloudflaredPath,
        [Parameter(Mandatory)][string]$TunnelId
    )

    # cloudflared pode emitir um aviso de versao no stderr mesmo com sucesso.
    # Ele nao deve transformar a verificacao de conectividade em falha.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $tunnelInfo = & $CloudflaredPath tunnel info $TunnelId 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        return $false
    }

    # As linhas de conectores ativos começam com o UUID do conector, sem rotulo.
    return $tunnelInfo -match '(?m)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s'
}

function Ensure-TunnelRunning {
    param(
        [Parameter(Mandatory)][string]$CloudflaredPath,
        [Parameter(Mandatory)][string]$ConfigPath,
        [Parameter(Mandatory)][string]$TunnelId,
        [Parameter(Mandatory)][string]$LogsPath,
        [Parameter(Mandatory)][string]$Stamp
    )

    Write-Step "Validando a configuracao do Cloudflare Tunnel"
    Invoke-Native -FilePath $CloudflaredPath -ArgumentList @('tunnel', '--config', $ConfigPath, 'ingress', 'validate') -Description 'A validacao do ingress do Cloudflare Tunnel'

    $runningProcesses = @(Get-TunnelProcesses -TunnelId $TunnelId -ConfigPath $ConfigPath)
    if ($runningProcesses.Count -gt 0 -and (Test-TunnelConnected -CloudflaredPath $CloudflaredPath -TunnelId $TunnelId)) {
        Write-Host "Cloudflare Tunnel $TunnelId ja esta conectado; nenhuma nova instancia sera iniciada."
        return
    }

    if ($runningProcesses.Count -gt 0) {
        Write-Host "Foi encontrada uma instancia do tunnel sem conector ativo. Reiniciando somente essa instancia..." -ForegroundColor Yellow
        foreach ($runningProcess in $runningProcesses) {
            Stop-Process -Id $runningProcess.ProcessId -ErrorAction Stop
        }
        Start-Sleep -Seconds 1
    }

    Write-Step "Iniciando o Cloudflare Tunnel configurado"
    $cloudflaredOutput = Join-Path $LogsPath "cloudflared-$Stamp.out.log"
    $cloudflaredError = Join-Path $LogsPath "cloudflared-$Stamp.err.log"
    $cloudflaredProcess = Start-Process -FilePath $CloudflaredPath `
        -ArgumentList @('tunnel', '--config', $ConfigPath, 'run', $TunnelId) `
        -WorkingDirectory (Split-Path -Parent $ConfigPath) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $cloudflaredOutput `
        -RedirectStandardError $cloudflaredError `
        -PassThru

    $deadline = (Get-Date).AddSeconds(20)
    do {
        if (-not (Get-Process -Id $cloudflaredProcess.Id -ErrorAction SilentlyContinue)) {
            throw "O Cloudflare Tunnel encerrou antes de conectar. Consulte $cloudflaredError."
        }
        if (Test-TunnelConnected -CloudflaredPath $CloudflaredPath -TunnelId $TunnelId) {
            Write-Host "Cloudflare Tunnel conectado (PID $($cloudflaredProcess.Id))."
            return
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    throw "O Cloudflare Tunnel iniciou, mas nao registrou um conector em 20 segundos. Consulte $cloudflaredError."
}

function Restart-RealtimeServer {
    param(
        [Parameter(Mandatory)][string]$NpmPath,
        [Parameter(Mandatory)][string]$ServerPath,
        [Parameter(Mandatory)][string]$LogsPath,
        [Parameter(Mandatory)][string]$Stamp,
        [Parameter(Mandatory)][string]$CurlPath
    )

    $existingProcess = Get-ListeningProcess -Port 8080
    if ($existingProcess) {
        $commandLine = [string]$existingProcess.CommandLine
        $isExpectedNodeServer = $existingProcess.Name -match '^node(\.exe)?$' -and
            $commandLine -match '(?i)(?:^|[\s\\/])server\.js(?:\s|$)'

        if (-not $isExpectedNodeServer) {
            throw "A porta 8080 esta sendo usada pelo PID $($existingProcess.ProcessId) ($($existingProcess.Name)). O inicializador nao o encerrou por seguranca."
        }

        Write-Step "Encerrando a instancia anterior do Node (PID $($existingProcess.ProcessId))"
        Stop-Process -Id $existingProcess.ProcessId -ErrorAction Stop
        if (-not (Wait-ForPortToClose -Port 8080 -TimeoutSeconds 10)) {
            throw 'A instancia anterior do Node nao liberou a porta 8080 em 10 segundos.'
        }
    }

    Write-Step 'Iniciando o servidor realtime Node'
    $nodeOutput = Join-Path $LogsPath "node-$Stamp.out.log"
    $nodeError = Join-Path $LogsPath "node-$Stamp.err.log"
    Start-Process -FilePath $NpmPath `
        -ArgumentList @('start') `
        -WorkingDirectory $ServerPath `
        -WindowStyle Hidden `
        -RedirectStandardOutput $nodeOutput `
        -RedirectStandardError $nodeError | Out-Null

    $newProcess = Wait-ForListeningPort -Port 8080 -TimeoutSeconds 20
    if (-not $newProcess) {
        throw "O servidor Node nao abriu a porta 8080. Consulte $nodeError."
    }

    $health = & $CurlPath --max-time 5 --fail --silent --show-error 'http://127.0.0.1:8080/health'
    if ($LASTEXITCODE -ne 0 -or $health -notmatch '"ok"\s*:\s*true') {
        throw "O servidor abriu a porta 8080, mas /health nao respondeu como esperado. Consulte $nodeError."
    }

    Write-Host "Servidor realtime ativo (PID $($newProcess.ProcessId)): $health"
}

function Show-RealtimeMonitor {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][int]$ServerProcessId,
        [Parameter(Mandatory)][string]$Revision,
        [string]$TunnelId
    )

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Tabuada Quest 2 — Realtime Monitor'
    $form.BackColor = [System.Drawing.Color]::FromArgb(7, 22, 36)
    $form.ForeColor = [System.Drawing.Color]::White
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedToolWindow
    $form.MaximizeBox = $false
    $form.MinimizeBox = $true
    $form.TopMost = $true
    $form.ShowInTaskbar = $true
    $form.ClientSize = New-Object System.Drawing.Size(400, 580)
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $form.Location = New-Object System.Drawing.Point(($area.Right - $form.Width - 18), ($area.Bottom - $form.Height - 18))

    $title = New-Object System.Windows.Forms.Label
    $title.Text = 'TQ'
    $title.Font = New-Object System.Drawing.Font('Segoe UI Black', 21, [System.Drawing.FontStyle]::Bold)
    $title.ForeColor = [System.Drawing.Color]::FromArgb(255, 195, 56)
    $title.BackColor = [System.Drawing.Color]::FromArgb(21, 54, 78)
    $title.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $title.Location = New-Object System.Drawing.Point(18, 18)
    $title.Size = New-Object System.Drawing.Size(62, 62)
    $form.Controls.Add($title)

    $heading = New-Object System.Windows.Forms.Label
    $heading.Text = 'REALTIME MONITOR'
    $heading.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
    $heading.Location = New-Object System.Drawing.Point(94, 22)
    $heading.Size = New-Object System.Drawing.Size(285, 28)
    $form.Controls.Add($heading)

    $state = New-Object System.Windows.Forms.Label
    $state.Text = '● SERVIDOR ATIVO'
    $state.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
    $state.ForeColor = [System.Drawing.Color]::FromArgb(104, 228, 143)
    $state.Location = New-Object System.Drawing.Point(96, 53)
    $state.Size = New-Object System.Drawing.Size(280, 22)
    $form.Controls.Add($state)

    function New-StatCard([string]$caption, [int]$x) {
        $panel = New-Object System.Windows.Forms.Panel
        $panel.BackColor = [System.Drawing.Color]::FromArgb(14, 41, 60)
        $panel.Location = New-Object System.Drawing.Point($x, 104)
        $panel.Size = New-Object System.Drawing.Size(174, 88)
        $captionLabel = New-Object System.Windows.Forms.Label
        $captionLabel.Text = $caption
        $captionLabel.ForeColor = [System.Drawing.Color]::FromArgb(158, 198, 220)
        $captionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Bold)
        $captionLabel.Location = New-Object System.Drawing.Point(12, 12)
        $captionLabel.Size = New-Object System.Drawing.Size(150, 20)
        $valueLabel = New-Object System.Windows.Forms.Label
        $valueLabel.Text = '—'
        $valueLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 25, [System.Drawing.FontStyle]::Bold)
        $valueLabel.ForeColor = [System.Drawing.Color]::White
        $valueLabel.Location = New-Object System.Drawing.Point(10, 31)
        $valueLabel.Size = New-Object System.Drawing.Size(152, 48)
        $panel.Controls.Add($captionLabel)
        $panel.Controls.Add($valueLabel)
        $form.Controls.Add($panel)
        return $valueLabel
    }

    $usersValue = New-StatCard 'USUÁRIOS ONLINE' 18
    $roomsValue = New-StatCard 'SALAS ATIVAS' 208

    $detailsTitle = New-Object System.Windows.Forms.Label
    $detailsTitle.Text = 'ATIVIDADE EM TEMPO REAL'
    $detailsTitle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
    $detailsTitle.ForeColor = [System.Drawing.Color]::FromArgb(158, 198, 220)
    $detailsTitle.Location = New-Object System.Drawing.Point(20, 218)
    $detailsTitle.Size = New-Object System.Drawing.Size(350, 22)
    $form.Controls.Add($detailsTitle)

    $details = New-Object System.Windows.Forms.TextBox
    $details.Multiline = $true
    $details.ReadOnly = $true
    $details.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $details.BackColor = [System.Drawing.Color]::FromArgb(10, 31, 47)
    $details.ForeColor = [System.Drawing.Color]::FromArgb(220, 239, 248)
    $details.Font = New-Object System.Drawing.Font('Consolas', 9)
    $details.Location = New-Object System.Drawing.Point(18, 244)
    $details.Size = New-Object System.Drawing.Size(364, 210)
    $form.Controls.Add($details)

    $footer = New-Object System.Windows.Forms.Label
    $footer.Text = "Porta $Port · commit $Revision"
    $footer.ForeColor = [System.Drawing.Color]::FromArgb(145, 181, 200)
    $footer.Font = New-Object System.Drawing.Font('Segoe UI', 8)
    $footer.Location = New-Object System.Drawing.Point(20, 472)
    $footer.Size = New-Object System.Drawing.Size(360, 20)
    $form.Controls.Add($footer)

    $stopButton = New-Object System.Windows.Forms.Button
    $stopButton.Text = 'Encerrar servidor'
    $stopButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $stopButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(225, 97, 83)
    $stopButton.BackColor = [System.Drawing.Color]::FromArgb(86, 35, 38)
    $stopButton.ForeColor = [System.Drawing.Color]::White
    $stopButton.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
    $stopButton.Location = New-Object System.Drawing.Point(18, 510)
    $stopButton.Size = New-Object System.Drawing.Size(364, 42)
    $stopButton.Add_Click({ $form.Close() })
    $form.Controls.Add($stopButton)

    $refresh = {
        $node = Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue
        if (-not $node) {
            $state.Text = '● SERVIDOR ENCERRADO'
            $state.ForeColor = [System.Drawing.Color]::FromArgb(255, 116, 103)
            $usersValue.Text = '—'
            $roomsValue.Text = '—'
            $details.Text = "O processo realtime foi encerrado.`r`n`r`nFeche esta janela para concluir."
            return
        }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
            $connections = @(Get-NetTCPConnection -LocalPort $Port -State Established -ErrorAction SilentlyContinue).Count
            $usersValue.Text = [string]$connections
            $roomsValue.Text = [string]$health.rooms
            $up = [TimeSpan]::FromSeconds([double]$health.uptime)
            $tunnelText = if ($TunnelId) { "Tunnel: $TunnelId" } else { 'Tunnel: não configurado' }
            $details.Text = "Servidor: ONLINE`r`nUsuários online: $connections`r`nSalas ativas: $($health.rooms)`r`nUptime: $($up.ToString('dd\.hh\:mm\:ss'))`r`nPID Node: $ServerProcessId`r`n$tunnelText`r`n`r`nAtualizado: $(Get-Date -Format 'HH:mm:ss')"
            $state.Text = '● SERVIDOR ATIVO'
            $state.ForeColor = [System.Drawing.Color]::FromArgb(104, 228, 143)
        }
        catch {
            $state.Text = '● AGUARDANDO RESPOSTA'
            $state.ForeColor = [System.Drawing.Color]::FromArgb(255, 195, 56)
            $details.Text = "O processo Node está ativo, mas a API de saúde não respondeu.`r`n`r`n$($_.Exception.Message)"
        }
    }
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 1000
    $timer.Add_Tick($refresh)
    $form.Add_Shown({ & $refresh; $timer.Start() })
    $form.Add_FormClosing({
        $timer.Stop()
        $node = Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue
        if ($node) { Stop-Process -Id $ServerProcessId -Force -ErrorAction SilentlyContinue }
    })
    [void]$form.ShowDialog()
}

if (-not (Test-Path -LiteralPath $serverDirectory)) {
    throw "Pasta do servidor nao encontrada: $serverDirectory"
}
if (-not (Test-Path -LiteralPath $cloudflaredConfig)) {
    throw "Configuracao do Cloudflare Tunnel nao encontrada: $cloudflaredConfig"
}

$gitPath = Get-RequiredCommandPath -Name 'git'
$npmPath = Get-RequiredCommandPath -Name 'npm.cmd'
$cloudflaredPath = Get-RequiredCommandPath -Name 'cloudflared'
$curlPath = Get-RequiredCommandPath -Name 'curl.exe'

$configText = Get-Content -LiteralPath $cloudflaredConfig -Raw
$tunnelMatch = [regex]::Match($configText, '(?m)^\s*tunnel\s*:\s*(?<value>\S+)')
$credentialsMatch = [regex]::Match($configText, '(?m)^\s*credentials-file\s*:\s*(?<value>\S+)')
if (-not $tunnelMatch.Success -or -not $credentialsMatch.Success) {
    throw "A configuracao em $cloudflaredConfig precisa conter tunnel e credentials-file."
}

$tunnelId = $tunnelMatch.Groups['value'].Value
$credentialsPath = [Environment]::ExpandEnvironmentVariables($credentialsMatch.Groups['value'].Value)
if (-not [IO.Path]::IsPathRooted($credentialsPath)) {
    $credentialsPath = Join-Path $cloudflaredDirectory $credentialsPath
}
if (-not (Test-Path -LiteralPath $credentialsPath)) {
    throw "Arquivo de credenciais do tunnel nao encontrado: $credentialsPath"
}

New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null

Push-Location $repoRoot
try {
    Write-Step 'Verificando ferramentas e alteracoes locais'
    $trackedChanges = (& $gitPath status --porcelain --untracked-files=no | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw 'Nao foi possivel verificar o estado do Git.'
    }
    if (-not [string]::IsNullOrWhiteSpace($trackedChanges)) {
        throw "Existem alteracoes rastreadas no repositorio. O pull foi cancelado para preserva-las.`n$trackedChanges"
    }

    $previousRevision = (& $gitPath rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Nao foi possivel identificar o commit atual.'
    }

    if (-not $SkipPull) {
        Write-Step 'Atualizando main com fast-forward'
        Invoke-Native -FilePath $gitPath -ArgumentList @('fetch', 'origin', 'main') -Description 'git fetch'
        Invoke-Native -FilePath $gitPath -ArgumentList @('checkout', 'main') -Description 'git checkout main'
        Invoke-Native -FilePath $gitPath -ArgumentList @('pull', '--ff-only', 'origin', 'main') -Description 'git pull --ff-only'
    }

    $currentRevision = (& $gitPath rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Nao foi possivel identificar o commit atualizado.'
    }

    $dependencyFilesChanged = $false
    if ($previousRevision -ne $currentRevision) {
        $changedFiles = @(& $gitPath diff --name-only "$previousRevision..$currentRevision" -- server/package.json server/package-lock.json)
        if ($LASTEXITCODE -ne 0) {
            throw 'Nao foi possivel verificar alteracoes de dependencias.'
        }
        $dependencyFilesChanged = $changedFiles.Count -gt 0
    }

    $wsDependency = Join-Path $serverDirectory 'node_modules\ws'
    if ($dependencyFilesChanged -or -not (Test-Path -LiteralPath $wsDependency)) {
        Write-Step 'Instalando dependencias do servidor'
        Push-Location $serverDirectory
        try {
            Invoke-Native -FilePath $npmPath -ArgumentList @('install') -Description 'npm.cmd install'
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host 'Dependencias do servidor ja estao presentes; npm install nao foi necessario.'
    }

    Ensure-TunnelRunning -CloudflaredPath $cloudflaredPath -ConfigPath $cloudflaredConfig -TunnelId $tunnelId -LogsPath $logsDirectory -Stamp $runStamp
    Restart-RealtimeServer -NpmPath $npmPath -ServerPath $serverDirectory -LogsPath $logsDirectory -Stamp $runStamp -CurlPath $curlPath

    $nodeProcess = Get-ListeningProcess -Port 8080
    if (-not $nodeProcess) {
        throw 'O processo Node não foi encontrado após a inicialização.'
    }
    Write-Host "`nPronto. Projeto em $currentRevision, tunnel $tunnelId e Node em http://127.0.0.1:8080/health." -ForegroundColor Green
    Show-RealtimeMonitor -Port 8080 -ServerProcessId $nodeProcess.ProcessId -Revision $currentRevision.Substring(0, 7) -TunnelId $tunnelId
}
finally {
    Pop-Location
}
