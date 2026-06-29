# Lever — Setup Automatizado pra Colaborador
# ============================================
# Uso (PowerShell):
#   iwr -useb https://raw.githubusercontent.com/<ORG>/lever/main/scripts/setup-lever.ps1 | iex
#
# Ou se já clonou o repo:
#   .\scripts\setup-lever.ps1
#
# O que esse script faz (idempotente — pode rodar 2x):
#   1. Instala Git, Node.js, Obsidian (via winget) se faltar
#   2. Pede teu nome/email pra configurar git
#   3. Clona o repo Lever em Documents\Lever System\lever (se nao tiver)
#   4. Roda npm install
#   5. Cria pasta Documents\Lever Brain (pro vault Obsidian Sync compartilhado do time)
#   6. Imprime instrucoes finais (aceitar invite Obsidian Sync)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# === CONFIG (editar quando preciso) ===
$REPO_URL    = 'https://github.com/leveragency/LeverSystem.git'
$BASE_DIR    = Join-Path $env:USERPROFILE 'Documents\Lever System'
$LEVER_DIR   = Join-Path $BASE_DIR 'lever'
$BRAIN_DIR   = Join-Path $env:USERPROFILE 'Documents\Lever Brain'

# === HELPERS ===
function Write-Step($msg) { Write-Host "`n→ $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red }

function Test-Command($cmd) {
    $null = Get-Command $cmd -ErrorAction SilentlyContinue
    return $?
}

function Install-WingetPackage($id, $friendlyName) {
    if (-not (Test-Command winget)) {
        Write-Fail "winget não disponível. Instala manualmente: $friendlyName"
        Write-Host "  Download: https://aka.ms/getwinget" -ForegroundColor Yellow
        throw "winget missing"
    }
    Write-Host "  Instalando $friendlyName via winget..."
    winget install --id $id --silent --accept-package-agreements --accept-source-agreements --disable-interactivity 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winget retornou $LASTEXITCODE — pode já estar instalado, seguindo"
    }
}

# ============================================
# 0. Apresentação
# ============================================
Clear-Host
Write-Host "===========================================" -ForegroundColor Magenta
Write-Host " Lever — Setup do Colaborador" -ForegroundColor Magenta
Write-Host "===========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Esse script vai preparar teu PC pra trabalhar com a Lever:" -ForegroundColor White
Write-Host "  • Git, Node, Obsidian instalados" -ForegroundColor Gray
Write-Host "  • Repo Lever clonado" -ForegroundColor Gray
Write-Host "  • Plugin Obsidian Git configurado pra sync automático" -ForegroundColor Gray
Write-Host ""
Write-Host "Tempo total: ~3-5 minutos." -ForegroundColor White
Write-Host ""

# ============================================
# 1. Pré-requisitos
# ============================================
Write-Step "1/6 — Verificando pré-requisitos"

# Git
if (Test-Command git) {
    $v = (git --version) -replace 'git version ', ''
    Write-OK "Git já instalado ($v)"
} else {
    Install-WingetPackage 'Git.Git' 'Git'
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (Test-Command git) { Write-OK "Git instalado" }
    else { Write-Warn "Git instalado mas não no PATH desta sessão. Feche e reabra o PowerShell, rode de novo." }
}

# Node
if (Test-Command node) {
    $v = (node --version)
    Write-OK "Node.js já instalado ($v)"
} else {
    Install-WingetPackage 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (Test-Command node) { Write-OK "Node instalado" }
    else { Write-Warn "Node instalado mas não no PATH desta sessão. Feche e reabra o PowerShell, rode de novo." }
}

# Obsidian
$obsidianPath = "$env:LOCALAPPDATA\Obsidian\Obsidian.exe"
if (Test-Path $obsidianPath) {
    Write-OK "Obsidian já instalado"
} else {
    Install-WingetPackage 'Obsidian.Obsidian' 'Obsidian'
    if (Test-Path $obsidianPath) { Write-OK "Obsidian instalado" } else { Write-Warn "Obsidian pode demorar 1-2 min pra aparecer. Pula este aviso se já tiver." }
}

# ============================================
# 2. Identidade Git (uma vez)
# ============================================
Write-Step "2/6 — Configurando identidade Git"
$gitEmail = git config --global user.email 2>$null
$gitName  = git config --global user.name 2>$null

if (-not $gitEmail -or -not $gitName) {
    Write-Host "  Precisamos do teu nome e email pra git ('vai aparecer em cada commit teu)" -ForegroundColor Yellow
    $gitName  = Read-Host "  Seu nome completo (ex: Wesley Souza)"
    $gitEmail = Read-Host "  Seu email"
    git config --global user.name  "$gitName"  | Out-Null
    git config --global user.email "$gitEmail" | Out-Null
    Write-OK "Git configurado: $gitName <$gitEmail>"
} else {
    Write-OK "Git já configurado: $gitName <$gitEmail>"
}

# ============================================
# 3. Clone do repo
# ============================================
Write-Step "3/6 — Clonando repositório Lever"

if (-not (Test-Path $BASE_DIR)) {
    New-Item -ItemType Directory -Path $BASE_DIR -Force | Out-Null
    Write-OK "Criada pasta $BASE_DIR"
}

if (Test-Path (Join-Path $LEVER_DIR '.git')) {
    Push-Location $LEVER_DIR
    Write-Host "  Repo já existe — fazendo git pull..."
    git pull --rebase 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-OK "Repo atualizado" }
    else { Write-Warn "pull falhou — talvez tenha mudanças locais não commitadas" }
    Pop-Location
} else {
    if ($REPO_URL -like '*<ORG-OU-USUARIO>*') {
        Write-Fail "URL do repo não configurada no script."
        Write-Host "  ⛔ Pede pro João/Pedro a URL correta e edita a linha 13 do setup-lever.ps1" -ForegroundColor Red
        Write-Host "  Ou cola aqui agora (vai usar só nesta execução):" -ForegroundColor Yellow
        $REPO_URL = Read-Host "  URL do repo (ex: https://github.com/leveragency/lever.git)"
    }
    Write-Host "  Clonando $REPO_URL..."
    git clone $REPO_URL $LEVER_DIR
    if ($LASTEXITCODE -eq 0) { Write-OK "Repo clonado em $LEVER_DIR" }
    else { Write-Fail "Falha ao clonar — verifica acesso ao repo"; throw "clone failed" }
}

# ============================================
# 4. npm install
# ============================================
Write-Step "4/6 — Instalando dependências do projeto"

Push-Location $LEVER_DIR
if (Test-Path 'package.json') {
    Write-Host "  Rodando npm install (pode demorar ~2 min)..."
    & npm install --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-OK "Dependências instaladas" }
    else { Write-Warn "npm install retornou $LASTEXITCODE — confere com 'npm install' manual depois" }
}
Pop-Location

# ============================================
# 5. Prepara pasta do vault Lever Brain (Obsidian Sync)
# ============================================
Write-Step "5/6 — Preparando pasta do vault Lever Brain"

if (-not (Test-Path $BRAIN_DIR)) {
    New-Item -ItemType Directory -Path $BRAIN_DIR -Force | Out-Null
    Write-OK "Pasta criada: $BRAIN_DIR"
} else {
    Write-OK "Pasta Lever Brain ja existe"
}

# Marker pra Obsidian reconhecer como vault (cria .obsidian/ vazio se nao tiver)
$brainObsidian = Join-Path $BRAIN_DIR '.obsidian'
if (-not (Test-Path $brainObsidian)) {
    New-Item -ItemType Directory -Path $brainObsidian -Force | Out-Null
}

# ============================================
# 6. Pronto
# ============================================
Write-Step "6/6 — Setup completo"

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host " ✅ TUDO PRONTO" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor White
Write-Host ""
Write-Host "  A) Abre o Obsidian" -ForegroundColor White
Write-Host ""
Write-Host "  B) Vault de CODIGO (opcional, pra devs):" -ForegroundColor White
Write-Host "     - 'Open folder as vault' -> aponta pra: $LEVER_DIR" -ForegroundColor Gray
Write-Host "     - Confia no Modo Restrito" -ForegroundColor Gray
Write-Host ""
Write-Host "  C) Vault de TIME (todos): Lever Brain (Obsidian Sync)" -ForegroundColor Yellow
Write-Host "     - Pede pro Joao mandar o invite do Obsidian Sync" -ForegroundColor Gray
Write-Host "     - No Obsidian: Settings -> Sync -> aceita o invite" -ForegroundColor Gray
Write-Host "     - Obsidian baixa o vault Lever Brain em: $BRAIN_DIR" -ForegroundColor Gray
Write-Host "     - Sincroniza em tempo real com todos do time" -ForegroundColor Gray
Write-Host ""
Write-Host "  D) Vault PESSOAL teu: continua igual, sem mudanca" -ForegroundColor Gray
Write-Host ""
Write-Host "Comeca lendo:" -ForegroundColor White
Write-Host "  README.md dentro do vault 'Lever Brain' (apos sync chegar)" -ForegroundColor Cyan
Write-Host ""
