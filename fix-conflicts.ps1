# Script to remove Git merge conflict markers from all files

$files = Get-ChildItem -Path "src" -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx

$filesFixed = 0

foreach ($file in $files) {
    try {
        $lines = Get-Content $file.FullName -ErrorAction Stop
        $hasConflicts = $false
        
        # Check if file has conflict markers
        foreach ($line in $lines) {
            if ($line -match '^<{7}\s' -or $line -match '^={7}$' -or $line -match '^>{7}\s') {
                $hasConflicts = $true
                break
            }
        }
        
        if ($hasConflicts) {
            Write-Host "Fixing: $($file.FullName)" -ForegroundColor Yellow
            
            $cleanedLines = @()
            $skipMode = $false
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i]
                
                # Check if this is a conflict marker
                if ($line -match '^<{7}\s') {
                    # Start of conflict - keep "ours" version (HEAD)
                    $skipMode = $false
                    continue
                }
                elseif ($line -match '^={7}$') {
                    # Middle marker - start skipping "theirs" version
                    $skipMode = $true
                    continue
                }
                elseif ($line -match '^>{7}\s') {
                    # End of conflict - stop skipping
                    $skipMode = $false
                    continue
                }
                
                # Add line if not in skip mode
                if (-not $skipMode) {
                    $cleanedLines += $line
                }
            }
            
            # Write cleaned content back to file
            $cleanedLines | Set-Content $file.FullName -Encoding UTF8
            $filesFixed++
        }
    }
    catch {
        Write-Host "Error processing $($file.FullName): $_" -ForegroundColor Red
    }
}

Write-Host "`nFixed $filesFixed files" -ForegroundColor Green
