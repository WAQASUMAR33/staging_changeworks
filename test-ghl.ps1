# GHL API Key Test Script (PowerShell)
# 
# This script tests GHL API keys to check if they can create sub-accounts.
# 
# Usage:
#   .\test-ghl.ps1 -ApiKey "your_api_key_here"
#   .\test-ghl.ps1 -ApiKey "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [string]$BusinessName = "Test Organization",
    [string]$Email = "test@example.com",
    [string]$Phone = "1234567890"
)

# Colors for output
function Write-ColorOutput {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    
    $colorMap = @{
        "Red" = "Red"
        "Green" = "Green"
        "Yellow" = "Yellow"
        "Blue" = "Blue"
        "Magenta" = "Magenta"
        "Cyan" = "Cyan"
        "White" = "White"
    }
    
    Write-Host $Text -ForegroundColor $colorMap[$Color]
}

function Show-Header {
    Write-ColorOutput "🔑 GHL API Key Test Script (PowerShell)" "Cyan"
    Write-ColorOutput "=" * 50 "Cyan"
    Write-Host ""
}

function Analyze-Key {
    param([string]$Key)
    
    Write-ColorOutput "📊 Key Analysis:" "Blue"
    Write-Host "   Length: $($Key.Length) characters"
    
    $keyType = "Unknown"
    $canCreateSubAccounts = $false
    
    if ($Key.StartsWith("pit-") -and $Key.Length -lt 100) {
        $keyType = "Personal Access Token (PAT)"
        $canCreateSubAccounts = $false
    } elseif ($Key.Length -gt 200 -and $Key.Length -lt 300) {
        $keyType = "Location API Key (JWT)"
        $canCreateSubAccounts = $false
    } elseif ($Key.Length -ge 300) {
        $keyType = "Agency API Key (JWT)"
        $canCreateSubAccounts = $true
    }
    
    Write-Host "   Type: $keyType"
    
    if ($canCreateSubAccounts) {
        Write-ColorOutput "   Can create sub-accounts: ✅ Yes" "Green"
    } else {
        Write-ColorOutput "   Can create sub-accounts: ❌ No" "Red"
    }
    
    Write-Host ""
    
    return @{
        KeyType = $keyType
        CanCreateSubAccounts = $canCreateSubAccounts
    }
}

function Test-GHLKey {
    param([string]$Key, [string]$Business, [string]$Email, [string]$Phone)
    
    $testData = @{
        name = $Business
        phone = $Phone
        companyId = "HegBO6PzXMfyDn0yFiFn"
        address = "123 Test Street"
        city = "Test City"
        state = "Test State"
        country = "US"
        postalCode = "12345"
        website = "https://test.com"
        timezone = "America/New_York"
        prospectInfo = @{
            firstName = $Business.Split(' ')[0]
            lastName = ($Business.Split(' ') | Select-Object -Skip 1) -join ' '
            email = $Email
        }
    } | ConvertTo-Json -Depth 3
    
    Write-ColorOutput "🚀 Testing GHL API Key..." "Yellow"
    $subAccountApiUrl = $env:GHL_SUB_ACCOUNT_CREATION_API_URL ?? "https://rest.gohighlevel.com/v1/locations/"
    Write-Host "   Endpoint: $subAccountApiUrl"
    Write-Host "   Key: $($Key.Substring(0, [Math]::Min(20, $Key.Length)))..."
    Write-Host ""
    
    try {
        $headers = @{
            "Authorization" = "Bearer $Key"
            "Content-Type" = "application/json"
            "Accept" = "application/json"
            "Version" = "2021-07-28"
        }
        
        $response = Invoke-RestMethod -Uri $subAccountApiUrl -Method POST -Body $testData -Headers $headers -TimeoutSec 30
        
        Write-ColorOutput "✅ SUCCESS!" "Green"
        Write-Host "   Status: 200 OK"
        Write-Host "   Location ID: $($response.id)"
        Write-Host "   Response: $($response | ConvertTo-Json -Depth 3)"
        
        return @{
            Success = $true
            Status = 200
            Data = $response
            LocationId = $response.id
        }
        
    } catch {
        Write-ColorOutput "❌ FAILED!" "Red"
        
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $statusDescription = $_.Exception.Response.StatusDescription
            
            Write-Host "   Status: $statusCode $statusDescription"
            
            try {
                $errorResponse = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorResponse)
                $errorBody = $reader.ReadToEnd()
                $errorData = $errorBody | ConvertFrom-Json
                
                Write-Host "   Error: $($errorData.message)"
                Write-Host "   Details: $($errorData | ConvertTo-Json -Depth 3)"
                
                Write-Host ""
                Write-ColorOutput "🔧 Troubleshooting:" "Yellow"
                
                if ($statusCode -eq 401) {
                    if ($errorData.message -and $errorData.message.Contains("Invalid JWT")) {
                        Write-Host "   • The API key is expired, invalid, or not the right type"
                        Write-Host "   • Check if you need an Agency API key instead of Location key"
                    } else {
                        Write-Host "   • The API key is invalid or expired"
                    }
                } elseif ($statusCode -eq 403) {
                    Write-Host "   • The API key is a Location key, not an Agency key"
                    Write-Host "   • Location keys cannot create sub-accounts"
                    Write-Host "   • You need an Agency API key for sub-account creation"
                } elseif ($statusCode -eq 400) {
                    Write-Host "   • The request data is invalid"
                    Write-Host "   • Check the test data format"
                } else {
                    Write-Host "   • Unknown error - check the error details above"
                }
                
                return @{
                    Success = $false
                    Status = $statusCode
                    Error = $errorData.message
                    Details = $errorData
                }
                
            } catch {
                Write-Host "   Error: Could not parse error response"
                Write-Host "   Raw response: $($_.Exception.Message)"
                
                return @{
                    Success = $false
                    Status = $statusCode
                    Error = "Could not parse error response"
                    Details = $_.Exception.Message
                }
            }
        } else {
            Write-Host "   Error: $($_.Exception.Message)"
            Write-Host "   • Network error or invalid URL"
            
            return @{
                Success = $false
                Error = $_.Exception.Message
                Details = "Network error"
            }
        }
    }
}

function Show-Usage {
    Write-ColorOutput "📖 Usage:" "Blue"
    Write-Host "   .\test-ghl.ps1 -ApiKey 'your_api_key_here'"
    Write-Host "   .\test-ghl.ps1 -ApiKey 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
    Write-Host ""
    Write-ColorOutput "📝 Examples:" "Blue"
    Write-Host "   .\test-ghl.ps1 -ApiKey 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
    Write-Host "   .\test-ghl.ps1 -ApiKey 'pit-f397ad9f-cf11-49b8-a791-658b934ec3f6'"
    Write-Host ""
    Write-ColorOutput "🔑 Key Types:" "Blue"
    Write-Host "   • Personal Access Token: ~50 chars, pit-xxxxxxxx format"
    Write-Host "   • Location API Key: ~200-300 chars, JWT format"
    Write-Host "   • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)"
    Write-Host ""
}

# Main execution
try {
    Show-Header
    
    if (-not $ApiKey) {
        Write-ColorOutput "❌ Error: API key is required" "Red"
        Show-Usage
        exit 1
    }
    
    # Analyze the API key
    $analysis = Analyze-Key -Key $ApiKey
    
    # Test the API key
    $result = Test-GHLKey -Key $ApiKey -Business $BusinessName -Email $Email -Phone $Phone
    
    Write-Host ""
    Write-ColorOutput "📊 Final Result:" "Blue"
    
    if ($result.Success) {
        Write-ColorOutput "✅ API key is valid and can create GHL sub-accounts!" "Green"
        Write-Host "   Location ID: $($result.LocationId)"
    } else {
        Write-ColorOutput "❌ API key cannot create GHL sub-accounts" "Red"
        Write-Host "   Error: $($result.Error)"
    }
    
    Write-Host ""
    
    if ($result.Success) {
        exit 0
    } else {
        exit 1
    }
    
} catch {
    Write-ColorOutput "❌ Script Error:" "Red"
    Write-Host $_.Exception.Message
    exit 1
}
