<#
PowerShell helper to create secrets for Cloud Build, grant access and submit Cloud Build.
Run this from a shell with gcloud authenticated and configured to the target project.
#>

param(
    [string]$ProjectId,
    [string]$Region = 'northamerica-south1'
)

function Prompt-SecureInput($prompt) {
    $secure = Read-Host -AsSecureString -Prompt $prompt
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (-not $ProjectId) {
    $ProjectId = Read-Host -Prompt 'Project ID (gcloud project)'
}

Write-Host "Using project: $ProjectId" -ForegroundColor Cyan

# Get project number
$projectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
if (-not $projectNumber) {
    Write-Error "Could not determine project number for $ProjectId"
    exit 1
}
Write-Host "Project number: $projectNumber"

# Prompt for secrets
$supabaseUrl = Prompt-SecureInput 'VITE_SUPABASE_URL'
$supabaseKey = Prompt-SecureInput 'VITE_SUPABASE_PUBLISHABLE_KEY'

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Error "Both values are required."
    exit 1
}

# Helper to create or update secret
function Create-OrUpdate-Secret($name, $value) {
    $exists = gcloud secrets list --filter="name:$name" --format='value(name)'

    if ($exists) {
        Write-Host "Updating secret $name..."
        $tempFile = New-TemporaryFile
        $value | Out-File -Encoding utf8 -FilePath $tempFile
        gcloud secrets versions add $name --data-file=$tempFile
        Remove-Item $tempFile -Force
    } else {
        Write-Host "Creating secret $name..."
        $tempFile = New-TemporaryFile
        $value | Out-File -Encoding utf8 -FilePath $tempFile
        gcloud secrets create $name --data-file=$tempFile
        Remove-Item $tempFile -Force
    }
}

Create-OrUpdate-Secret -name 'VITE_SUPABASE_URL' -value $supabaseUrl
Create-OrUpdate-Secret -name 'VITE_SUPABASE_PUBLISHABLE_KEY' -value $supabaseKey

# Grant Cloud Build service account access to secrets
$cbSa = "$projectNumber@cloudbuild.gserviceaccount.com"
Write-Host "Granting Secret Manager access to service account: $cbSa"
gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$cbSa" `
  --role=roles/secretmanager.secretAccessor

# Submit build (this will use cloudbuild.yaml in repo root)
Write-Host "Submitting Cloud Build..." -ForegroundColor Green
# Use substitutions if you want to pass them as well; secrets will be injected via availableSecrets
gcloud builds submit --project=$ProjectId --region=$Region --config=cloudbuild.yaml .

Write-Host "Build submitted. Monitor Cloud Build console for progress." -ForegroundColor Green
