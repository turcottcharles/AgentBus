# Creates the "Agent Bus" Start-menu and desktop shortcuts (and the app icon, if missing).
# Safe to re-run: shortcuts are overwritten in place.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$exe = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $exe)) {
    Push-Location $root
    try { npm install --no-audit --no-fund; node node_modules\electron\install.js } finally { Pop-Location }
}
if (-not (Test-Path $exe)) { throw "Electron was not installed at $exe" }

$ico = Join-Path $root 'app\icon.ico'
if (-not (Test-Path $ico)) {
    Add-Type -AssemblyName System.Drawing
    $size = 256
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $size, $size),
        ([System.Drawing.Color]::FromArgb(255, 10, 23, 36)), ([System.Drawing.Color]::FromArgb(255, 2, 6, 11)), 45
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 56; $path.AddArc(8, 8, $r, $r, 180, 90); $path.AddArc($size - 8 - $r, 8, $r, $r, 270, 90)
    $path.AddArc($size - 8 - $r, $size - 8 - $r, $r, $r, 0, 90); $path.AddArc(8, $size - 8 - $r, $r, $r, 90, 90); $path.CloseFigure()
    $g.FillPath($bg, $path)
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 229, 255)), 6), $path)
    # Three nodes joined to a hub: agents on a shared bus.
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 229, 255)), 12
    $hub = @(128, 136); $nodes = @(@(70, 78), @(186, 78), @(128, 200))
    foreach ($n in $nodes) { $g.DrawLine($pen, $hub[0], $hub[1], $n[0], $n[1]) }
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 229, 255))
    foreach ($n in $nodes) { $g.FillEllipse($white, $n[0] - 26, $n[1] - 26, 52, 52) }
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 157, 0))), $hub[0] - 20, $hub[1] - 20, 40, 40)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $png = $ms.ToArray()
    # ICO container holding one 256x256 PNG image.
    $fs = [System.IO.File]::Create($ico); $w = New-Object System.IO.BinaryWriter $fs
    $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)
    $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$png.Length); $w.Write([uint32]22)
    $w.Write($png); $w.Close()
}

$shell = New-Object -ComObject WScript.Shell
$targets = @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Agent Bus.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Agent Bus.lnk')
)
foreach ($t in $targets) {
    $s = $shell.CreateShortcut($t)
    $s.TargetPath = $exe
    $s.Arguments = "`"$root`""
    $s.WorkingDirectory = $root
    $s.IconLocation = "$ico,0"
    $s.Description = 'Agent Bus: see and message your Claude Code and Codex sessions'
    $s.Save()
    Write-Host "Shortcut: $t"
}
