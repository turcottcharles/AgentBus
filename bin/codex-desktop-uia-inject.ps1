# Gated Codex Desktop composer inspect/submit. Never stops ChatGPT.exe.
# Never foregrounds, clicks, or SendKeys (those steal focus / hit the wrong app).
# Pause the caller if chat, emptiness, or Invoke submit cannot be confirmed.
param(
  [ValidateSet('probe','send')]
  [string]$Mode = 'probe',
  [string]$Text = '',
  [string]$TargetChat = 'Editor agent-bus',
  [string]$Needle = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Emit($obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 6
  Write-Output $json
}

function Get-ChatWindows {
  Get-Process ChatGPT -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    ForEach-Object {
      [System.Windows.Automation.AutomationElement]::FromHandle($_.MainWindowHandle)
    } |
    Where-Object { $_ -ne $null }
}

function Element-Text([System.Windows.Automation.AutomationElement]$el) {
  if ($null -eq $el) { return '' }
  $parts = @($el.Current.Name, $el.Current.AutomationId)
  try {
    $pat = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($pat) { $parts += $pat.Current.Value }
  } catch {}
  return ($parts -join ' ')
}

function Window-HasChat($win, $title) {
  if ($win.Current.Name -like "*$title*") { return $true }
  $cond = [System.Windows.Automation.Condition]::TrueCondition
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  $limit = 0
  foreach ($el in $all) {
    $limit++
    if ($limit -gt 400) { break }
    $t = Element-Text $el
    if ($t -like "*$title*") { return $true }
  }
  return $false
}

function Find-Composer($win) {
  $edits = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Edit))
  )
  $docs = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Document))
  )
  foreach ($el in @($edits + $docs)) {
    if (-not $el.Current.IsEnabled) { continue }
    $pat = $null
    try { $pat = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern) } catch {}
    if ($pat -and -not $pat.Current.IsReadOnly) {
      return @{ El = $el; Pattern = $pat }
    }
  }
  return $null
}

function Composer-Empty($value) {
  $v = if ($null -eq $value) { '' } else { "$value" }
  $trim = $v.Trim()
  if ($trim.Length -eq 0) { return $true }
  $placeholders = @(
    'What do you want to get done?',
    'Work with Codex',
    'Ask Codex',
    'Message Codex'
  )
  foreach ($p in $placeholders) { if ($trim -eq $p) { return $true } }
  return $false
}

function Find-Send($win, $composer) {
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($el in $all) {
    if (-not $el.Current.IsEnabled) { continue }
    $label = $el.Current.Name
    if ($label -notmatch '^(Send|Submit)( message| prompt)?$') { continue }
    try {
      $inv = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      if ($inv) { return @{ El = $el; Pattern = $inv; Name = $label } }
    } catch {}
  }
  return $null
}

$wins = @(Get-ChatWindows)
if ($wins.Count -eq 0) {
  Emit @{ ok = $false; reason = 'no-desktop-window' }
  exit 2
}

$win = $null
foreach ($w in $wins) {
  if (Window-HasChat $w $TargetChat) { $win = $w; break }
}
if ($null -eq $win) {
  Emit @{ ok = $false; reason = 'chat-mismatch'; target = $TargetChat; window = $wins[0].Current.Name }
  exit 3
}

$composer = Find-Composer $win
if ($null -eq $composer) {
  Emit @{ ok = $false; reason = 'no-composer'; chat = $TargetChat }
  exit 4
}

$value = $composer.Pattern.Current.Value
$empty = Composer-Empty $value
$send = Find-Send $win $composer

$probe = @{
  ok = $true
  chat = $TargetChat
  composer = $composer.El.Current.Name
  composerEmpty = [bool]$empty
  composerValueLength = ("$value").Length
  canInvoke = [bool]($send -ne $null)
  invokeName = if ($send) { $send.Name } else { $null }
  focusStolen = $false
}

if ($Mode -eq 'probe') {
  if (-not $empty) { $probe.ok = $false; $probe.reason = 'composer-not-empty' }
  Emit $probe
  if ($probe.ok) { exit 0 } else { exit 5 }
}

if (-not $Text) {
  Emit @{ ok = $false; reason = 'text-required' }
  exit 2
}
if (-not $empty) {
  Emit @{ ok = $false; reason = 'composer-not-empty'; uncertain = $false; focusStolen = $false }
  exit 5
}
$original = $value
$composer.Pattern.SetValue($Text)
Start-Sleep -Milliseconds 200
$after = $composer.Pattern.Current.Value
$needleCheck = if ($Needle) { $Needle } else { $Text.Substring(0, [Math]::Min(32, $Text.Length)) }
if ("$after" -notlike "*$needleCheck*") {
  try { $composer.Pattern.SetValue($original) } catch {}
  Emit @{ ok = $false; reason = 'setvalue-unconfirmed'; uncertain = $true; focusStolen = $false }
  exit 7
}

$send = Find-Send $win $composer
if (-not $send) {
  try { $composer.Pattern.SetValue($original) } catch {}
  Emit @{ ok = $false; reason = 'no-invoke'; uncertain = $true; focusStolen = $false }
  exit 6
}

$send.Pattern.Invoke()
Start-Sleep -Milliseconds 400
$final = $composer.Pattern.Current.Value
$cleared = Composer-Empty $final
if (-not $cleared) {
  try { $composer.Pattern.SetValue($original) } catch {}
}
Emit @{
  ok = [bool]$cleared
  submitted = [bool]$cleared
  reason = if ($cleared) { 'invoked' } else { 'submit-unconfirmed' }
  uncertain = -not $cleared
  chat = $TargetChat
  invokeName = $send.Name
  focusStolen = $false
}
if ($cleared) { exit 0 } else { exit 8 }
