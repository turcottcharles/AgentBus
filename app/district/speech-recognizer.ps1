param(
    [ValidateSet('status', 'capture')]
    [string]$Mode = 'status'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

# Static, local-only System.Speech engine. Status never creates an engine or
# opens audio. Capture is a single phrase, started only by explicit desktop IPC.
# API references:
# https://learn.microsoft.com/en-us/dotnet/api/system.speech.recognition.speechrecognitionengine.installedrecognizers
# https://learn.microsoft.com/en-us/dotnet/api/system.speech.recognition.speechrecognitionengine.recognizeasync

function Write-JsonEvent([hashtable]$Value) {
    [Console]::Out.WriteLine(($Value | ConvertTo-Json -Compress -Depth 5))
    [Console]::Out.Flush()
}

function Bounded-Text([string]$Value, [int]$Maximum = 1200) {
    if ($null -eq $Value) { return '' }
    if ($Value.Length -gt $Maximum) { return $Value.Substring(0, $Maximum) }
    return $Value
}

try {
    Add-Type -AssemblyName System.Speech
    $installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
    $recognizers = @($installed | Select-Object -First 64 | ForEach-Object {
        @{ id = (Bounded-Text $_.Id 512); name = (Bounded-Text $_.Name 256); culture = $_.Culture.Name }
    })
    $english = @($installed | Where-Object { $_.Culture.Name -eq 'en-US' })
} catch {
    $message = 'Windows offline speech recognition could not be loaded. Keep typing. ' + (Bounded-Text $_.Exception.Message 800)
    if ($Mode -eq 'status') { Write-JsonEvent @{ type = 'status'; available = $false; reason = $message; recognizers = @() }; exit 0 }
    Write-JsonEvent @{ type = 'error'; message = $message }
    Write-JsonEvent @{ type = 'stopped'; reason = 'error' }
    exit 1
}

if ($Mode -eq 'status') {
    $reason = 'Offline en-US recognition is installed. The microphone is checked only when you start speaking.'
    if ($english.Count -eq 0) { $reason = 'The offline English (United States) recognizer is not installed. Keep typing.' }
    Write-JsonEvent @{ type = 'status'; available = ($english.Count -gt 0); reason = $reason; recognizers = $recognizers }
    exit 0
}

if ($english.Count -eq 0) {
    Write-JsonEvent @{ type = 'error'; message = 'The offline English (United States) recognizer is not installed. Keep typing.' }
    Write-JsonEvent @{ type = 'stopped'; reason = 'error' }
    exit 1
}

$engine = $null
$subscriptions = @()
$finalText = $null
$errorText = $null
$reason = 'no_speech'
$exitCode = 0
try {
    $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($english[0])
    $engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(60)
    $engine.BabbleTimeout = [TimeSpan]::FromSeconds(60)
    $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(1000)
    $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(1000)
    $subscriptions += Register-ObjectEvent -InputObject $engine -EventName SpeechHypothesized -SourceIdentifier 'district.speech.partial'
    $subscriptions += Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier 'district.speech.final'
    $subscriptions += Register-ObjectEvent -InputObject $engine -EventName RecognizeCompleted -SourceIdentifier 'district.speech.completed'
    # This is the only microphone-opening call, strictly below capture mode.
    $engine.SetInputToDefaultAudioDevice()
    $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Single)
    Write-JsonEvent @{ type = 'listening' }
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    $done = $false
    while (-not $done -and [DateTime]::UtcNow -lt $deadline) {
        $null = Wait-Event -Timeout 1
        foreach ($event in @(Get-Event | Sort-Object EventIdentifier)) {
            try {
                if ($event.SourceIdentifier -eq 'district.speech.partial' -and -not $done) {
                    $text = [string]$event.SourceEventArgs.Result.Text
                    if ($text.Length -gt 0 -and $text.Length -le 8000) { Write-JsonEvent @{ type = 'partial'; text = $text } }
                } elseif ($event.SourceIdentifier -eq 'district.speech.final' -and -not $done) {
                    $text = [string]$event.SourceEventArgs.Result.Text
                    if ($text.Trim().Length -gt 0 -and $text.Length -le 8000) {
                        $finalText = $text; $reason = 'completed'; $done = $true
                    } else { $errorText = 'The completed phrase was empty or too long. Keep typing.'; $reason = 'error'; $exitCode = 1; $done = $true }
                } elseif ($event.SourceIdentifier -eq 'district.speech.completed' -and -not $done) {
                    if ($event.SourceEventArgs.Error) { throw $event.SourceEventArgs.Error }
                    $reason = 'no_speech'; $done = $true
                }
            } finally { Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue }
        }
    }
    if (-not $done) { $reason = 'timeout'; $errorText = 'Dictation reached its 60-second limit. Keep typing or start again.'; $exitCode = 1 }
    if ($reason -eq 'no_speech') { $errorText = 'No completed speech phrase was recognized. Keep typing or start again.' }
} catch {
    $reason = 'error'; $exitCode = 1
    $errorText = 'Offline dictation could not capture speech. Keep typing. ' + (Bounded-Text $_.Exception.Message 850)
} finally {
    # Detach handlers before disposing their .NET source. Removing a handler
    # from a disposed recognizer can throw even with SilentlyContinue.
    foreach ($name in @('district.speech.partial', 'district.speech.final', 'district.speech.completed')) {
        try { Unregister-Event -SourceIdentifier $name -ErrorAction Stop } catch {}
        try { Get-Event -SourceIdentifier $name -ErrorAction SilentlyContinue | Remove-Event -ErrorAction SilentlyContinue } catch {}
    }
    if ($engine) {
        try { $engine.RecognizeAsyncCancel() } catch {}
        try { $engine.SetInputToNull() } catch {}
        try { $engine.Dispose() } catch {}
    }
}

# Never use SpeechHypothesized as a final result. Publish only the recognizer's
# completed phrase after releasing audio; the parent also waits for process exit.
if ($finalText -and -not $errorText) { Write-JsonEvent @{ type = 'final'; text = $finalText } }
if ($errorText) { Write-JsonEvent @{ type = 'error'; message = (Bounded-Text $errorText 1200) } }
Write-JsonEvent @{ type = 'stopped'; reason = $reason }
exit $exitCode
